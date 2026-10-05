const mongoose = require('mongoose');

// Persistent idempotency record for Razorpay webhook events.
// Razorpay retries webhook delivery, so the same event may arrive multiple
// times (and concurrently with client-side verification). The unique index
// on eventId makes "claim this event" atomic: exactly one worker wins and
// performs state transitions; losers safely acknowledge as duplicates.
//
// Privacy: stores identifiers + outcome only. No raw payloads, no secrets,
// no PII beyond the Razorpay order/payment IDs needed for reconciliation.
const paymentWebhookEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: [true, 'Razorpay event ID is required'],
    unique: true,
    index: true,
    trim: true
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    trim: true,
    maxlength: [80, 'Event type cannot exceed 80 characters'],
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['received', 'processed', 'failed'],
      message: 'Status must be received, processed or failed'
    },
    default: 'received',
    index: true
  },
  razorpayOrderId: {
    type: String,
    trim: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    trim: true,
    index: true
  },
  error: {
    type: String,
    trim: true,
    maxlength: [500, 'Error cannot exceed 500 characters']
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
