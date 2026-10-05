const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: [150, 'Email cannot exceed 150 characters'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
    maxlength: [15, 'Phone cannot exceed 15 characters'],
    validate: {
      validator: function (v) {
        if (!v) return false;
        return /^\+?[0-9\s\-]{8,15}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  numberOfGuests: {
    type: Number,
    default: 1,
    min: [1, 'Number of guests must be at least 1'],
    max: [20, 'Number of guests cannot exceed 20']
  },
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Confirmed', 'Rejected', 'Cancelled'],
      message: 'Status must be Pending, Confirmed, Rejected or Cancelled'
    },
    default: 'Pending',
    index: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  ticketId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  ticketIssuedAt: {
    type: Date
  },
  ticketStatus: {
    type: String,
    enum: ['NotIssued', 'Active', 'Used', 'Cancelled'],
    default: 'NotIssued',
    index: true
  },
  checkedInAt: {
    type: Date
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Pending', 'Paid', 'Refunded'],
    default: 'Unpaid'
  }
}, {
  timestamps: true
});

// Prevent duplicate active registration for same user and event
// Allow re-registration after Cancelled/Rejected by using partial index
// Only Pending and Confirmed are considered active
registrationSchema.index(
  { user: 1, event: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['Pending', 'Confirmed'] }
    }
  }
);

registrationSchema.index({ event: 1, status: 1 });
registrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
