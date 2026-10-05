const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Scheme = require('../models/Scheme');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail } = require('../utils/mailer');
const { sendOtpSms, isSmsConfigured, normalizePhone } = require('../utils/sms');

const bookmarkKey = (id) => String(id);

const dedupeBookmarkIds = (bookmarks = []) => {
  const seen = new Set();
  const deduped = [];
  for (const id of bookmarks) {
    const key = bookmarkKey(id);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(id);
    }
  }
  return deduped;
};

const pruneInvalidBookmarks = async (user) => {
  const deduped = dedupeBookmarkIds(user.bookmarks);
  const validSchemes = await Scheme.find({ _id: { $in: deduped } }).select('_id');
  const validKeys = new Set(validSchemes.map((scheme) => bookmarkKey(scheme._id)));
  const cleaned = deduped.filter((id) => validKeys.has(bookmarkKey(id)));

  if (cleaned.length !== user.bookmarks.length) {
    user.bookmarks = cleaned;
    await user.save();
  }

  return cleaned;
};

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX = 3;

const hashOtp = (rawOtp) => {
  return crypto.createHash('sha256').update(rawOtp).digest('hex');
};

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  bookmarks: user.bookmarks || [],
  createdAt: user.createdAt,
  formattedCreatedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null,
  organizationName: user.organizationName || null,
  organizationType: user.organizationType || null,
  phone: user.phone || null,
  phoneVerified: user.phoneVerified || false,
  notificationPreferences: user.notificationPreferences || { inApp: true, email: true, sms: false },
  bio: user.bio || null,
  isOrganizerVerified: user.isOrganizerVerified || false
});

const extractValidationErrors = (err) => {
  if (err.name !== 'ValidationError') return null;
  const errors = {};
  for (const field in err.errors) {
    errors[field] = err.errors[field].message;
  }
  return Object.values(errors)[0] || 'Validation failed';
};

const register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        errors: {
          name: !name ? 'Name is required' : undefined,
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long'
      });
    }

    let normalizedPhone = null;
    if (phone && typeof phone === 'string') {
      normalizedPhone = normalizePhone(phone.trim());
      const phoneRegex = /^\+91[6-9]\d{9}$/;
      if (!phoneRegex.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid Indian mobile number' });
      }
      const phoneExists = await User.findOne({ phone: normalizedPhone });
      if (phoneExists) {
        return res.status(400).json({ success: false, message: 'This phone number is already registered' });
      }
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const allowAdminRegister = process.env.ALLOW_PUBLIC_ADMIN_REGISTER === 'true';
    const safeRole = allowAdminRegister && role === 'admin' ? 'admin' : 'user';

    const userData = {
      name: trimmedName,
      email: email.toLowerCase().trim(),
      password,
      role: safeRole
    };
    if (normalizedPhone) {
      userData.phone = normalizedPhone;
    }

    const user = await User.create(userData);

    if (user) {
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          ...sanitizeUser(user),
          token: generateToken(user._id, user.role)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid user data provided'
      });
    }
  } catch (err) {
    const validationMsg = extractValidationErrors(err);
    if (validationMsg) {
      return res.status(400).json({
        success: false,
        message: validationMsg
      });
    }

    console.error('Register error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      data: {
        ...sanitizeUser(user),
        token: generateToken(user._id, user.role)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.'
    });
  }
};

const RESET_TOKEN_EXPIRY_MS = 20 * 60 * 1000;

const hashResetToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

// Always returns the same generic response so callers cannot enumerate accounts.
const forgotPasswordResponse = (res, emailSent) => {
  return res.json({
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
    data: { emailSent: Boolean(emailSent) }
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    console.log('[Auth] Forgot password request for:', normalizedEmail);

    const user = await User.findOne({ email: normalizedEmail });
    // Generic response for unknown emails (prevents account enumeration).
    if (!user) {
      console.log('[Auth] No user found for email (generic response)');
      return forgotPasswordResponse(res, false);
    }

    console.log('[Auth] User found:', user._id.toString(), 'provider:', user.provider);

    // OAuth-only accounts without a local password use provider login instead.
    if (!user.password && user.provider !== 'local') {
      console.log('[Auth] OAuth-only account, no local password');
      return forgotPasswordResponse(res, false);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashResetToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${frontendBase}/reset-password/${rawToken}`;

    console.log('[Auth] Calling sendPasswordResetEmail, isEmailConfigured:', require('../utils/mailer').isEmailConfigured());

    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
      console.log('[Auth] Password reset email sent successfully');
      return forgotPasswordResponse(res, true);
    } catch (mailErr) {
      // Do not leave a live token when delivery failed; report honestly.
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.warn('[Auth] Password reset email failed:', mailErr.code || mailErr.message);
      return forgotPasswordResponse(res, false);
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const hashedToken = hashResetToken(token.trim());
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    // Only the password changes — role, provider and all other fields stay untouched.
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully. Please login with your new password.' });
  } catch (err) {
    const validationMsg = extractValidationErrors(err);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body || {};

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Indian mobile number' });
    }

    if (!isSmsConfigured()) {
      return res.status(503).json({ success: false, message: 'SMS service is not configured. Please try again later.' });
    }

    // Uniqueness is enforced against OTHER accounts only: the requesting user
    // may (re)send an OTP for the number already on their own profile.
    // A number owned by a different user is always rejected and no OTP is sent.
    const existingOwner = await User.findOne({ phone: normalizedPhone }).select('_id');
    if (existingOwner && String(existingOwner._id) !== String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered to another account' });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    if (!req.user) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      const hashedTempToken = hashOtp(tempToken);
      await User.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId() },
        { $set: { phone: normalizedPhone, phoneVerificationToken: hashedOtp, phoneVerificationExpires: expiresAt, phoneVerificationAttempts: 0, phoneVerificationLastSent: new Date() } },
        { upsert: false }
      );
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    req.user.phone = normalizedPhone;
    req.user.phoneVerificationToken = hashedOtp;
    req.user.phoneVerificationExpires = expiresAt;
    req.user.phoneVerificationAttempts = 0;
    req.user.phoneVerificationLastSent = new Date();
    await req.user.save({ validateBeforeSave: false });

    try {
      await sendOtpSms({ to: normalizedPhone, otp });
      return res.json({ success: true, message: 'OTP sent successfully. Please check your phone.' });
    } catch (smsErr) {
      req.user.phoneVerificationToken = undefined;
      req.user.phoneVerificationExpires = undefined;
      req.user.phoneVerificationAttempts = 0;
      req.user.phoneVerificationLastSent = undefined;
      await req.user.save({ validateBeforeSave: false });
      console.warn('Phone OTP send failed:', smsErr.code || smsErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
    }
  } catch (err) {
    console.error('Send phone OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const verifyPhoneOtp = async (req, res) => {
  try {
    const { otp } = req.body || {};

    if (!otp || typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit OTP' });
    }

    const user = await User.findById(req.user._id).select('+phoneVerificationToken +phoneVerificationExpires +phoneVerificationAttempts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.phoneVerificationToken || !user.phoneVerificationExpires) {
      return res.status(400).json({ success: false, message: 'No OTP pending. Please request a new OTP.' });
    }

    if (user.phoneVerificationExpires < new Date()) {
      user.phoneVerificationToken = undefined;
      user.phoneVerificationExpires = undefined;
      user.phoneVerificationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    if (user.phoneVerificationAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashedOtp = hashOtp(otp);
    if (user.phoneVerificationToken !== hashedOtp) {
      user.phoneVerificationAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    user.phoneVerified = true;
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationLastSent = undefined;
    await user.save();

    return res.json({ success: true, message: 'Phone number verified successfully!', data: { phoneVerified: true, phone: user.phone } });
  } catch (err) {
    console.error('Verify phone OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const updatePhone = async (req, res) => {
  try {
    const { phone } = req.body || {};

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Indian mobile number' });
    }

    const existingUser = await User.findOne({ phone: normalizedPhone, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered to another account' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.phone === normalizedPhone && user.phoneVerified) {
      return res.json({ success: true, message: 'Phone number is already verified', data: { phone: user.phone, phoneVerified: true } });
    }

    if (!isSmsConfigured()) {
      return res.status(503).json({ success: false, message: 'SMS service is not configured. Please try again later.' });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    user.phone = normalizedPhone;
    user.phoneVerified = false;
    user.phoneVerificationToken = hashedOtp;
    user.phoneVerificationExpires = expiresAt;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationLastSent = new Date();
    await user.save({ validateBeforeSave: false });

    try {
      await sendOtpSms({ to: normalizedPhone, otp });
      return res.json({ success: true, message: 'OTP sent to new phone number. Please verify.', data: { phone: normalizedPhone, phoneVerified: false } });
    } catch (smsErr) {
      user.phoneVerificationToken = undefined;
      user.phoneVerificationExpires = undefined;
      user.phoneVerificationAttempts = 0;
      user.phoneVerificationLastSent = undefined;
      await user.save({ validateBeforeSave: false });
      console.warn('Phone OTP send failed:', smsErr.code || smsErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
    }
  } catch (err) {
    console.error('Update phone error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const resendPhoneOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+phoneVerificationToken +phoneVerificationExpires +phoneVerificationAttempts +phoneVerificationLastSent');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.phone) {
      return res.status(400).json({ success: false, message: 'No phone number on file. Please add a phone number first.' });
    }

    if (!isSmsConfigured()) {
      return res.status(503).json({ success: false, message: 'SMS service is not configured. Please try again later.' });
    }

    if (user.phoneVerificationLastSent && Date.now() - user.phoneVerificationLastSent.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - user.phoneVerificationLastSent.getTime())) / 1000);
      return res.status(429).json({ success: false, message: `Please wait ${waitSeconds} seconds before requesting a new OTP.` });
    }

    if (user.phoneVerificationExpires && user.phoneVerificationExpires > new Date()) {
      const remainingSeconds = Math.ceil((user.phoneVerificationExpires.getTime() - Date.now()) / 1000);
      return res.status(400).json({ success: false, message: `An OTP is already valid for ${remainingSeconds} more seconds.` });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    user.phoneVerificationToken = hashedOtp;
    user.phoneVerificationExpires = expiresAt;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationLastSent = new Date();
    await user.save({ validateBeforeSave: false });

    try {
      await sendOtpSms({ to: user.phone, otp });
      return res.json({ success: true, message: 'New OTP sent successfully. Please check your phone.' });
    } catch (smsErr) {
      user.phoneVerificationToken = undefined;
      user.phoneVerificationExpires = undefined;
      user.phoneVerificationAttempts = 0;
      user.phoneVerificationLastSent = undefined;
      await user.save({ validateBeforeSave: false });
      console.warn('Phone OTP resend failed:', smsErr.code || smsErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
    }
  } catch (err) {
    console.error('Resend phone OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const deletePhone = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.phone) {
      return res.status(400).json({ success: false, message: 'No phone number to remove' });
    }

    user.phone = undefined;
    user.phoneVerified = false;
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationLastSent = undefined;
    await user.save();

    return res.json({ success: true, message: 'Phone number removed successfully' });
  } catch (err) {
    console.error('Delete phone error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const { inApp, email, sms } = req.body || {};

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (typeof inApp === 'boolean') user.notificationPreferences.inApp = inApp;
    if (typeof email === 'boolean') user.notificationPreferences.email = email;
    if (typeof sms === 'boolean') {
      if (sms && !user.phoneVerified) {
        return res.status(400).json({ success: false, message: 'SMS notifications require a verified phone number' });
      }
      user.notificationPreferences.sms = sms;
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Notification preferences updated',
      data: { notificationPreferences: user.notificationPreferences }
    });
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

const toggleBookmark = async (req, res) => {
  try {
    const { schemeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schemeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    const scheme = await Scheme.findById(schemeId).select('_id');
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found. It may have been removed.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await pruneInvalidBookmarks(user);

    const targetKey = bookmarkKey(scheme._id);
    const bookmarkIndex = user.bookmarks.findIndex(
      (id) => bookmarkKey(id) === targetKey
    );
    let action;

    if (bookmarkIndex > -1) {
      user.bookmarks.splice(bookmarkIndex, 1);
      action = 'removed';
    } else {
      user.bookmarks.push(scheme._id);
      action = 'added';
    }

    await user.save();
    await user.populate('bookmarks', 'title category status imageUrl');

    const bookmarks = user.bookmarks.filter((entry) => entry && entry._id);

    res.json({
      success: true,
      message: action === 'added' ? 'Scheme added to bookmarks' : 'Scheme removed from bookmarks',
      data: {
        bookmarks,
        bookmarked: action === 'added'
      }
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }
    console.error('Bookmark error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating bookmarks'
    });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await pruneInvalidBookmarks(user);
    await user.populate('bookmarks', 'title category status imageUrl');

    const bookmarks = (user.bookmarks || []).filter((entry) => entry && entry._id);

    res.json({
      success: true,
      data: bookmarks
    });
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bookmarks'
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (String(targetUser._id) === String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Prevent deleting any admin account
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be deleted'
      });
    }

    await User.findByIdAndDelete(id);

    // Clean up orphaned bookmarks for deleted user
    try {
      const Bookmark = require('../models/Bookmark');
      await Bookmark.deleteMany({ user: id });
    } catch (cleanupErr) {
      console.warn('Bookmark cleanup warning:', cleanupErr.message);
    }

    res.json({
      success: true,
      message: `User "${targetUser.name}" deleted successfully`
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user'
    });
  }
};

module.exports = { register, login, forgotPassword, resetPassword, getMyProfile, toggleBookmark, getBookmarks, getUsers, deleteUser, sendPhoneOtp, verifyPhoneOtp, updatePhone, resendPhoneOtp, deletePhone, updateNotificationPreferences };
