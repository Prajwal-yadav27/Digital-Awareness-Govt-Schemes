const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// In-memory storage for redirect tokens (development only)
// Maps redirect_token -> { jwt, expiresAt }
const googleOAuthTokens = new Map();

// In-memory storage for OAuth CSRF state (development only).
// Maps state -> expiresAt (ms). Single-use and short-lived.
const googleOAuthStates = new Map();

const storeOAuthState = () => {
  const state = crypto.randomBytes(16).toString('hex');
  googleOAuthStates.set(state, Date.now() + 120000);
  setTimeout(() => googleOAuthStates.delete(state), 120000);
  return state;
};

const generateRedirectToken = (jwt, expiresInMs = 120000) => {
  const token = crypto.randomBytes(32).toString('hex');
  googleOAuthTokens.set(token, { jwt, expiresAt: Date.now() + expiresInMs });
  // Set timeout to auto-cleanup expired token
  setTimeout(() => googleOAuthTokens.delete(token), expiresInMs);
  return token;
};

const exchangeRedirectToken = (token) => {
  const entry = googleOAuthTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    googleOAuthTokens.delete(token);
    return null;
  }
  // Single-use: remove after exchange
  googleOAuthTokens.delete(token);
  return entry.jwt;
};

/**
 * Initiate Google OAuth redirect
 * User will be redirected to Google's consent screen
 */
const googleAuthInit = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  const scopes = 'profile email';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'select_account'
  });

  // CSRF protection: unpredictable, single-use, short-lived state.
  const state = storeOAuthState();
  params.set('state', state);

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  res.redirect(googleAuthUrl);
};

/**
 * Google OAuth callback handler
 * Exchanges authorization code for token, creates/finds user, generates JWT
 * Redirects to login with secure redirect token (no JWT in URL)
 */
const googleAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Google authorization code not provided'
      });
    }

    // Validate OAuth state (CSRF protection) — must be present, known, and unexpired.
    if (!state || !googleOAuthStates.has(state)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state'
      });
    }
    const stateExpiresAt = googleOAuthStates.get(state);
    googleOAuthStates.delete(state); // single-use
    if (Date.now() > stateExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state'
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        success: false,
        message: 'Google token exchange failed: ' + (tokenData.error_description || tokenData.error)
      });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'No email received from Google'
      });
    }

    // Lowercase email for consistent lookup
    const email = userInfo.email.toLowerCase();
    const name = userInfo.name || '';
    const profileImage = userInfo.picture || '';

    // Find existing user by email
    let user = await User.findOne({ email });

    if (user) {
      // User exists — update provider info if needed, never overwrite password
      if (user.provider !== 'google') {
        user.provider = 'google';
      }
      if (user.providerId !== userInfo.sub) {
        user.providerId = userInfo.sub;
      }
      if (profileImage && !user.profileImage) {
        user.profileImage = profileImage;
      }
      // Always update profileImage to keep it current
      if (profileImage) {
        user.profileImage = profileImage;
      }
      await user.save();
    } else {
      // New user from Google — default to role "user"
      user = await User.create({
        name,
        email,
        password: '', // No password for OAuth users
        provider: 'google',
        providerId: userInfo.sub,
        profileImage
      });
    }

    // Generate JWT — SAME format as normal login
    const token = generateToken(user._id, user.role);

    // Generate a secure redirect token and redirect to login
    // The JWT will be transferred via the exchange endpoint, not in the URL
    const redirectToken = generateRedirectToken(token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/login?rt=${redirectToken}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Google auth callback error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication. Please try again.'
    });
  }
};

/**
 * Exchange redirect token for JWT
 * Used by frontend on mount to get the JWT without exposing it in URL
 */
const exchangeGoogleOAuthToken = async (req, res) => {
  try {
    const { rt } = req.query;

    if (!rt) {
      return res.status(400).json({
        success: false,
        message: 'Redirect token not provided'
      });
    }

    const jwtToken = exchangeRedirectToken(rt);

if (!jwtToken) {
  return res.status(400).json({
    success: false,
    message: 'Invalid or expired redirect token'
  });
}

// Decode JWT payload to get user ID
const payload = jwt.decode(jwtToken);

    if (!payload || !payload.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    // Find the actual user in MongoDB by the ID stored in the JWT
    // This ensures we return real user data (name, email, etc.) rather than
    // undefined values from naive JWT decoding
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
        token: jwtToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          bookmarks: user.bookmarks || [],
          phone: user.phone || null,
          phoneVerified: user.phoneVerified || false,
          isOrganizerVerified: user.isOrganizerVerified || false,
          notificationPreferences: user.notificationPreferences || { inApp: true, email: true, sms: false },
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
    console.error('Google OAuth token exchange error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication exchange. Please try again.'
    });
  }
};

module.exports = { googleAuthInit, googleAuthCallback, exchangeGoogleOAuthToken };