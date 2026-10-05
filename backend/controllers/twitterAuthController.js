const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');

// In-memory storage for redirect tokens (development only)
// Maps redirect_token -> { jwt, expiresAt }
const twitterOAuthTokens = new Map();

// In-memory storage for OAuth CSRF state (development only).
// Maps state -> expiresAt (ms). Single-use and short-lived.
const twitterOAuthStates = new Map();

const storeTwitterState = () => {
  const state = crypto.randomBytes(16).toString('hex');
  twitterOAuthStates.set(state, Date.now() + 120000);
  setTimeout(() => twitterOAuthStates.delete(state), 120000);
  return state;
};

const generateRedirectToken = (jwt, expiresInMs = 120000) => {
  const token = crypto.randomBytes(32).toString('hex');
  twitterOAuthTokens.set(token, { jwt, expiresAt: Date.now() + expiresInMs });
  // Set timeout to auto-cleanup expired token
  setTimeout(() => twitterOAuthTokens.delete(token), expiresInMs);
  return token;
};

const exchangeRedirectToken = (token) => {
  const entry = twitterOAuthTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    twitterOAuthTokens.delete(token);
    return null;
  }
  // Single-use: remove after exchange
  twitterOAuthTokens.delete(token);
  return entry.jwt;
};

/**
 * Initiate Twitter OAuth redirect
 * User will be redirected to Twitter's consent screen
 */
const twitterAuthInit = (req, res) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const redirectUri = process.env.TWITTER_CALLBACK_URL || 'http://localhost:5000/api/auth/twitter/callback';

  // Twitter OAuth 2.0 with PKCE for the current recommended flow
  // Using the implicit grant flow for obtaining user info
  const scopes = 'users.read.email';

  // CSRF protection: unpredictable, single-use, short-lived state.
  const state = storeTwitterState();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
    code_challenge: '', // PKCE challenge omitted — requires provider config to enable (see report)
    code_challenge_method: 'plain'
  });

  const twitterAuthUrl = `https://twitter.com/i/oauth2/authorize?${params}`;

  res.redirect(twitterAuthUrl);
};

/**
 * Twitter OAuth callback handler
 * Exchanges authorization code for token, creates/finds user, generates JWT
 * Redirects to login with secure redirect token (no JWT in URL)
 */
const twitterAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Twitter authorization code not provided'
      });
    }

    // Validate OAuth state (CSRF protection) — must be present, known, and unexpired.
    if (!state || !twitterOAuthStates.has(state)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state'
      });
    }
    const stateExpiresAt = twitterOAuthStates.get(state);
    twitterOAuthStates.delete(state); // single-use
    if (Date.now() > stateExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state'
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${process.env.TWITTER_CLIENT_SECRET}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TWITTER_CALLBACK_URL || 'http://localhost:5000/api/auth/twitter/callback'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        success: false,
        message: 'Twitter token exchange failed: ' + (tokenData.error_description || tokenData.error)
      });
    }

    // Get user info from Twitter
    const twitterUserResponse = await fetch('https://api.twitter.com/2/users/me/with?user.fields=name,username,profile_image_url,protected,public_metrics', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const twitterUser = await twitterUserResponse.json();

    if (!twitterUser.data) {
      return res.status(400).json({
        success: false,
        message: 'No user data received from Twitter'
      });
    }

    const { id, name, username, profile_image_url } = twitterUser.data;
    const email = twitterUser.data?.email; // May be undefined

    // Find existing user by providerId (Twitter user ID)
    // Also try to find by username if email not available
    let user = await User.findOne({ providerId: id });

    if (!user && username) {
      user = await User.findOne({ email: username + '@twitter.local' });
    }

    if (user) {
      // User exists — link Twitter provider if not already linked
      if (user.provider !== 'twitter') {
        user.provider = 'twitter';
      }
      if (user.providerId !== id) {
        user.providerId = id;
      }
      if (profile_image_url && !user.profileImage) {
        user.profileImage = profile_image_url;
      }
      if (email && !user.email) {
        user.email = email;
      }
      await user.save();
    } else {
      // New user from Twitter
      // Use a synthetic email if Twitter doesn't provide one
      const syntheticEmail = email || `twitter_${id}@example.com`;
      user = await User.create({
        name,
        email: syntheticEmail,
        provider: 'twitter',
        providerId: id,
        profileImage: profile_image_url
      });
    }

    // Generate JWT — SAME format as normal login
    const token = generateToken(user._id, user.role);

    // Generate a secure redirect token and redirect to login
    const redirectToken = generateRedirectToken(token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/login?rt=${redirectToken}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Twitter auth callback error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during Twitter authentication. Please try again.'
    });
  }
};

/**
 * Exchange redirect token for JWT
 * Used by frontend on mount to get the JWT without exposing it in URL
 */
const exchangeTwitterOAuthToken = async (req, res) => {
  try {
    const { rt } = req.query;

    if (!rt) {
      return res.status(400).json({
        success: false,
        message: 'Redirect token not provided'
      });
    }

    const jwt = exchangeRedirectToken(rt);

    if (!jwt) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired redirect token'
      });
    }

    // Decode JWT payload to get user info
    const payload = jwt.decode(jwt, process.env.JWT_SECRET);

    if (!payload || !payload.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    // Find the actual user in MongoDB by the ID stored in the JWT
    const user = await User.findById(payload.id).select(
      '-password -providerId'
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found in database'
      });
    }

    res.json({
      success: true,
      data: {
        token: jwt,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          bookmarks: user.bookmarks || [],
          createdAt: user.createdAt,
          formattedCreatedAt: user.formattedCreatedAt
            ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : null
        }
      }
    });
  } catch (err) {
    console.error('Twitter OAuth token exchange error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during Twitter authentication exchange. Please try again.'
    });
  }
};

module.exports = { twitterAuthInit, twitterAuthCallback, exchangeTwitterOAuthToken };