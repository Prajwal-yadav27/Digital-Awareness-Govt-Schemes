const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, resetPassword, getMyProfile, toggleBookmark, getBookmarks, getUsers, deleteUser, sendPhoneOtp, verifyPhoneOtp, updatePhone, resendPhoneOtp, deletePhone, updateNotificationPreferences } = require('../controllers/authController');
const { googleAuthCallback, exchangeGoogleOAuthToken } = require('../controllers/googleAuthController');
const { twitterAuthCallback, exchangeTwitterOAuthToken } = require('../controllers/twitterAuthController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { googleAuthInit } = require('../controllers/googleAuthController');
const { twitterAuthInit } = require('../controllers/twitterAuthController');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.get('/google', authLimiter, googleAuthInit);
router.get('/google/callback', googleAuthCallback);
router.get('/google/exchange', exchangeGoogleOAuthToken);
router.get('/twitter', authLimiter, twitterAuthInit);
router.get('/twitter/callback', twitterAuthCallback);
router.get('/twitter/exchange', exchangeTwitterOAuthToken);
router.get('/profile', protect, getMyProfile);
router.get('/users', protect, authorize('admin'), getUsers);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);
router.post('/bookmarks/:schemeId', protect, toggleBookmark);
router.get('/bookmarks', protect, getBookmarks);

// Phone verification routes
router.post('/phone/send-otp', protect, authLimiter, sendPhoneOtp);
router.post('/phone/verify-otp', protect, authLimiter, verifyPhoneOtp);
router.patch('/phone', protect, authLimiter, updatePhone);
router.post('/phone/resend-otp', protect, authLimiter, resendPhoneOtp);
router.delete('/phone', protect, authLimiter, deletePhone);

// Notification preferences
router.patch('/preferences/notifications', protect, updateNotificationPreferences);

module.exports = router;
