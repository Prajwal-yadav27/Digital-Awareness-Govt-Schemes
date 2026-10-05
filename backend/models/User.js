const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: function() {
      return this.provider === 'local';
    },
    validate: {
      validator: function(v) {
        // Google OAuth users don't require a password
        if (this.provider === 'google') return true;
        // Local users must have password >= 6 chars; OAuth users with no password skip
        if (!v) return this.provider !== 'local';
        return typeof v === 'string' && v.length >= 6;
      },
      message: 'Password must be at least 6 characters'
    }
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'organizer', 'admin'],
      message: 'Role must be either user, organizer or admin'
    },
    default: 'user'
  },
  organizationName: {
    type: String,
    trim: true,
    maxlength: [80, 'Organization name cannot exceed 80 characters']
  },
  organizationType: {
    type: String,
    trim: true,
    maxlength: [80, 'Organization type cannot exceed 80 characters']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters'],
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [15, 'Phone cannot exceed 15 characters'],
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^\+?[0-9\s\-]{8,15}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerificationToken: {
    type: String,
    select: false,
    default: undefined
  },
  phoneVerificationExpires: {
    type: Date,
    select: false,
    default: undefined
  },
  phoneVerificationAttempts: {
    type: Number,
    default: 0
  },
  phoneVerificationLastSent: {
    type: Date,
    default: undefined
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  isOrganizerVerified: {
    type: Boolean,
    default: false
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'twitter'],
    default: 'local'
  },
  providerId: {
    type: String,
    index: true
  },
  profileImage: {
    type: String
  },
  passwordResetToken: {
    type: String,
    select: false,
    default: undefined
  },
  passwordResetExpires: {
    type: Date,
    select: false,
    default: undefined
  },
  notificationPreferences: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  }]
}, {
  timestamps: true
});



userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  if (!this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
