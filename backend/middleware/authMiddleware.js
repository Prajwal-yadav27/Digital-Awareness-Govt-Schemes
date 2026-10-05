const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User associated with this token no longer exists'
        });
      }

      req.user = user;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.',
          errorCode: 'TOKEN_EXPIRED'
        });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token. Please login again.',
          errorCode: 'TOKEN_INVALID'
        });
      }

      console.error('Auth middleware error:', err);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Please try again.'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. No token provided.'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)} role is not authorized to perform this action.`
      });
    }
    next();
  };
};

// Organizer event-management gate: same role check as authorize(), plus
// verified-organizer enforcement. Admins always bypass (verification and
// ownership restrictions never apply to them). A non-admin organizer must
// have BOTH role === 'organizer' AND isOrganizerVerified === true, so
// legacy/unverified organizer rows cannot perform organizer actions until
// an admin explicitly verifies them.
const verifiedOrganizer = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)} role is not authorized to perform this action.`
      });
    }

    if (req.user.role !== 'admin' && !req.user.isOrganizerVerified) {
      return res.status(403).json({
        success: false,
        message: 'Organizer account is not verified. Please contact an administrator.'
      });
    }
    next();
  };
};

module.exports = { protect, authorize, verifiedOrganizer };
