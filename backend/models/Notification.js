const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'EVENT_APPROVED',
  'EVENT_REJECTED',
  'REGISTRATION_SUCCESS',
  'REGISTRATION_CANCELLED',
  'REGISTRATION_CONFIRMED',
  'REGISTRATION_REJECTED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PAYMENT_REFUNDED',
  'TICKET_GENERATED',
  'EVENT_UPDATED',
  'EVENT_PENDING',
  'CHECK_IN_SUCCESS',
  'SCHEME_EXPIRED',
  'SCHEME_DEADLINE',
  'EVENT_REGISTRATION',
  'EVENT_REMINDER',
  'EVENT_CANCELLED',
  'REGISTRATION_CONFIRMED',
  'REGISTRATION_REJECTED',
  'REGISTRATION_CANCELLED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'TICKET_GENERATED',
  'CHECK_IN_SUCCESS',
  'ADMIN_ANNOUNCEMENT'
];

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  type: {
    type: String,
    enum: { values: NOTIFICATION_TYPES, message: 'Invalid notification type: {VALUE}' },
    required: [true, 'Notification type is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedScheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  },
  relatedRegistration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
