const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: [true, 'Registration is required'],
    unique: true
  },
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
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    trim: true,
    maxlength: 3
  },
  razorpayOrderId: {
    type: String,
    required: [true, 'Razorpay order ID is required'],
    unique: true,
    sparse: true,
    trim: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  razorpaySignature: {
    type: String,
    trim: true
  },
  razorpayRefundId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount cannot be negative']
  },
  refundedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Paid', 'Failed', 'Refunded'],
      message: 'Status must be Pending, Paid, Failed or Refunded'
    },
    default: 'Pending'
  },
  paidAt: {
    type: Date
  },
  failureReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Failure reason cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

paymentSchema.index({ user: 1, event: 1 });
paymentSchema.index({ registration: 1, razorpayOrderId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
