const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { signOAuthState, verifyOAuthState } = require('../utils/oauthState');
const { signExchangeToken, verifyExchangeToken } = require('../utils/oauthExchange');
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Stateless OAuth exchange tokens ("rt") — see backend/utils/oauthExchange.js.
// The former process-local Map is intentionally removed: callback and
// exchange may run on different Render instances. Single-use is NOT
// guaranteed statelessly (documented limitation); tokens are short-lived
// (~2 minutes), audience-bound, and exchange mints a fresh access token.

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

  // CSRF protection: unpredictable, short-lived, HMAC-signed stateless state.
  // No process-memory storage so verification survives restarts/scale.
  let state;
  try {
    state = signOAuthState(process.env.JWT_SECRET);
  } catch (_) {
    return res.status(500).json({
      success: false,
      message: 'Server error during Google authentication. Please try again.'
    });
  }
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

    // Validate OAuth state (CSRF protection) — stateless HMAC verification.
    // Must be present, well-formed, correctly signed, and unexpired.
    if (!state || !verifyOAuthState(state, process.env.JWT_SECRET)) {
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

    // Generate a stateless, short-lived exchange token and redirect.
    // The application JWT is minted at exchange time, never in the URL.
    let redirectToken;
    try {
      redirectToken = signExchangeToken(user._id, user.role, process.env.JWT_SECRET);
    } catch (_) {
      return res.status(500).json({
        success: false,
        message: 'Server error during Google authentication. Please try again.'
      });
    }

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

    const exchangePayload = verifyExchangeToken(rt, process.env.JWT_SECRET);

if (!exchangePayload) {
  return res.status(400).json({
    success: false,
    message: 'Invalid or expired redirect token'
  });
}

    const exchangeUserId = exchangePayload.sub;

    if (!exchangeUserId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    // Find the actual user in MongoDB by the ID in the exchange token.
    // Role is always re-read from the database (never trusted from the
    // token) and a FRESH application access token is minted here, so the
    // short-lived exchange token is never usable as an access token.
    const user = await User.findById(exchangeUserId).select(
      '-password -providerId'
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found in database'
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      data: {
        token,
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