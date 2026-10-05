const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment, handlePaymentWebhook, refundPayment, getPaymentByRegistration, getMyPayments } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');

// POST /api/payments/webhook - Razorpay server-to-server callback.
// Intentionally NO JWT auth and NO rate limiter: Razorpay authenticates via
// X-Razorpay-Signature over the raw body, and throttling could drop retried
// deliveries. Forged calls fail signature verification with HTTP 400.
router.post('/webhook', handlePaymentWebhook);

router.post('/create-order', protect, authorize('user'), paymentLimiter, createPaymentOrder);
router.post('/verify', protect, authorize('user'), paymentLimiter, verifyPayment);

// POST /api/payments/:paymentId/refund - ADMIN ONLY. Issues a real, full
// Razorpay refund. Organizers and normal users always receive 403 here.
router.post('/:paymentId/refund', protect, authorize('admin'), paymentLimiter, refundPayment);

// GET /api/payments/my - before /registration/:registrationId
router.get('/my', protect, authorize('user'), getMyPayments);

router.get('/registration/:registrationId', protect, authorize('user', 'organizer', 'admin'), getPaymentByRegistration);

module.exports = router;
