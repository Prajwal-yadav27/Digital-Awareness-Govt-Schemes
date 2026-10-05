const Payment = require('../models/Payment');
const PaymentWebhookEvent = require('../models/PaymentWebhookEvent');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendPaymentSuccessNotification, sendPaymentFailedNotification, sendPaymentRefundedNotification, sendTicketGeneratedNotification } = require('../utils/notificationService');
let Razorpay;
try { Razorpay = require('razorpay'); } catch (_) { Razorpay = null; }

const getRazorpayInstance = () => {
  if (!Razorpay) throw new Error('Razorpay package not installed');
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const verifySignature = (orderId, paymentId, signature, secret) => {
  if (!secret || typeof signature !== 'string') return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // Constant-time comparison to avoid leaking signature validity via timing.
  let signatureBuf;
  try {
    signatureBuf = Buffer.from(signature, 'hex');
  } catch (_) {
    return false;
  }
  const expectedBuf = Buffer.from(expected, 'hex');
  if (signatureBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};

const generateTicketId = () => {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `EVT-${year}-${rand}`;
};

const generateUniqueTicketId = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTicketId();
    const exists = await Registration.findOne({ ticketId: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  return `EVT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-8)}${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
};

// POST /api/payments/create-order - user only
const createPaymentOrder = async (req, res) => {
  try {
    const { registrationId } = req.body;

    if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Valid registrationId is required' });
    }

    const registration = await Registration.findById(registrationId).populate('event');
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (String(registration.user._id || registration.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this registration' });
    }

    const event = registration.event;
    if (!event || typeof event === 'string') {
      return res.status(404).json({ success: false, message: 'Associated event not found' });
    }

    if (event.status !== 'Approved') {
      return res.status(400).json({ success: false, message: `Cannot pay for event with status ${event.status}` });
    }

    if (!event.isPaidEvent || !event.registrationFee || event.registrationFee <= 0) {
      return res.status(400).json({ success: false, message: 'This is a free event. No payment required.' });
    }

    if (['Cancelled', 'Rejected'].includes(registration.status)) {
      return res.status(400).json({ success: false, message: `Cannot pay for registration with status ${registration.status}` });
    }

    // Check existing payment
    const existingPayment = await Payment.findOne({ registration: registrationId });
    if (existingPayment && existingPayment.status === 'Paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already completed for this registration',
        data: {
          alreadyPaid: true,
          paymentId: existingPayment._id,
          orderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock'
        }
      });
    }

    const amount = Math.round(event.registrationFee * (registration.numberOfGuests || 1));
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount calculated from database' });
    }

    let order;
    try {
      const instance = getRazorpayInstance();
      order = await instance.orders.create({
        amount: amount * 100, // paise
        currency: 'INR',
        receipt: `reg_${registrationId.toString().slice(-12)}_${Date.now()}`,
        notes: { registrationId: String(registrationId), eventId: String(event._id), userId: String(req.user._id) }
      });
    } catch (rzErr) {
      if (process.env.PAYMENT_MOCK_MODE === 'true') {
        console.warn('Razorpay order creation failed, using mock order (PAYMENT_MOCK_MODE=true):', rzErr.message || rzErr);
        order = {
          id: `order_mock_${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
          amount: amount * 100,
          currency: 'INR'
        };
      } else {
        console.error('Razorpay order creation failed:', rzErr.message || rzErr);
        return res.status(503).json({ success: false, message: 'Payment service is currently unavailable. Please try again.' });
      }
    }

    let payment;
    if (existingPayment) {
      existingPayment.razorpayOrderId = order.id;
      existingPayment.amount = amount;
      existingPayment.status = 'Pending';
      await existingPayment.save();
      payment = existingPayment;
    } else {
      payment = new Payment({
        registration: registrationId,
        user: req.user._id,
        event: event._id,
        amount,
        currency: 'INR',
        razorpayOrderId: order.id,
        status: 'Pending'
      });
      await payment.save();
    }

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: order.id,
        amount,
        currency: 'INR',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock'
      }
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating payment order' });
  }
};

// POST /api/payments/verify - user only
const verifyPayment = async (req, res) => {
  try {
    const { registrationId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!registrationId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'All payment fields are required for verification' });
    }
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (String(registration.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to verify this payment' });
    }

    if (['Cancelled', 'Rejected'].includes(registration.status)) {
      return res.status(400).json({ success: false, message: `Cannot verify payment for ${registration.status} registration` });
    }

    const payment = await Payment.findOne({ registration: registrationId, razorpayOrderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order' });
    }

    if (payment.status === 'Paid') {
      return res.status(200).json({ success: true, message: 'Payment already verified', data: payment });
    }

    const isValid = verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      payment.status = 'Failed';
      payment.failureReason = 'Invalid signature';
      await payment.save();

      // Send payment failed notification
      await sendPaymentFailedNotification(req.user._id, registration.event.title).catch(() => {});

      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'Paid';
    payment.paidAt = new Date();
    await payment.save();

    // Update registration: mark paid and auto-confirm with ticket issuance for paid events
    registration.paymentStatus = 'Paid';
    if (registration.status === 'Pending') {
      registration.status = 'Confirmed';
      if (!registration.ticketId) {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
      }
      if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
      registration.ticketStatus = 'Active';
    } else if (registration.status === 'Confirmed' && registration.ticketStatus !== 'Active') {
      if (!registration.ticketId) {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
      }
      registration.ticketStatus = 'Active';
      if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
    }
    await registration.save();

    // Send payment success notification
    await sendPaymentSuccessNotification(req.user._id, registration.event.title, payment.amount).catch(() => {});

    // Send ticket generated notification if ticket was created
    if (registration.ticketId && registration.ticketStatus === 'Active') {
      await sendTicketGeneratedNotification(req.user._id, registration.event.title, registration.ticketId).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: payment
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: 'Server error verifying payment' });
  }
};

// Shared FULL-refund reconciliation used by both the admin refund endpoint
// (after Razorpay accepts the refund) and refund.processed webhooks.
// Atomic compare-and-set guarantees exactly one caller performs the
// transition; concurrent losers receive { transitioned: false } and must
// NOT notify, so notifications fire exactly once per refund.
// Final state: Payment=Refunded (+refund id/amount/time), registration
// paymentStatus=Refunded, registration moved to Cancelled (Pending/Confirmed
// only), ticket Cancelled unless already Used, event seat count restored.
// Ticket and payment records are kept for audit history — never deleted.
const applyRefundReconciliation = async (payment, { razorpayRefundId, registration: preloadedRegistration = null }) => {
  const transitioned = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'Refunded' } },
    {
      $set: {
        status: 'Refunded',
        razorpayRefundId,
        refundAmount: payment.amount,
        refundedAt: new Date()
      }
    },
    { new: true }
  );
  if (!transitioned) {
    return { transitioned: false, payment };
  }

  let registration = preloadedRegistration;
  if (!registration) {
    registration = await Registration.findById(payment.registration).populate('event');
  }
  if (registration) {
    let seatsToRelease = 0;
    if (['Pending', 'Confirmed'].includes(registration.status)) {
      registration.status = 'Cancelled';
      seatsToRelease = registration.numberOfGuests || 1;
    }
    registration.paymentStatus = 'Refunded';
    // A used (checked-in) ticket records history and is left alone;
    // everything else becomes unusable so verification rejects it.
    if (registration.ticketStatus !== 'Used') {
      registration.ticketStatus = 'Cancelled';
    }
    await registration.save();

    if (seatsToRelease > 0 && registration.event) {
      try {
        const eventId = registration.event._id || registration.event;
        await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: -seatsToRelease } });
        const refreshed = await Event.findById(eventId).select('registrationCount');
        if (refreshed && refreshed.registrationCount < 0) {
          await Event.findByIdAndUpdate(eventId, { $set: { registrationCount: 0 } });
        }
      } catch (e) {
        console.warn('Failed to restore event capacity after refund:', e.message);
      }
    }

    const eventTitle = (registration.event && registration.event.title) || 'Event';
    await sendPaymentRefundedNotification(String(registration.user), eventTitle, transitioned.amount).catch(() => {});
  }

  return { transitioned: true, payment: transitioned, registration };
};

// POST /api/payments/webhook - Razorpay server-to-server callback.
// IMPORTANT: no JWT authentication here. Razorpay authenticates via the
// X-Razorpay-Signature header computed over the exact raw request body
// (stashed as req.rawBody by the JSON parser — see server.js). Normal
// users, organizers and admins cannot invoke capture through this endpoint:
// unknown order IDs never create payments, registrations or tickets.
const handlePaymentWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[PAYMENT WEBHOOK] Rejected: RAZORPAY_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ success: false, message: 'Webhook handler is not configured' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;
  if (!signature || typeof signature !== 'string' || !rawBody) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  // Verify HMAC-SHA256 hex digest with constant-time comparison.
  // Never log the signature, the secret, or the raw payload.
  let signatureValid = false;
  try {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    signatureValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);
  } catch (_) {
    signatureValid = false;
  }
  if (!signatureValid) {
    console.warn('[PAYMENT WEBHOOK] Rejected: invalid signature');
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const body = req.body || {};
  const eventId = typeof body.id === 'string' ? body.id : null;
  const eventType = typeof body.event === 'string' ? body.event : null;
  if (!eventId || !eventType) {
    return res.status(400).json({ success: false, message: 'Malformed webhook payload' });
  }

  const SUPPORTED_EVENTS = ['payment.captured', 'payment.failed', 'refund.created', 'refund.processed', 'refund.failed'];
  if (!SUPPORTED_EVENTS.includes(eventType)) {
    console.log('[PAYMENT WEBHOOK] Unsupported event acknowledged:', eventType, 'event:', eventId);
    return res.json({ success: true, received: true, reconciled: false, reason: 'unsupported_event' });
  }

  // Payment events carry payload.payment.entity; refund events carry
  // payload.refund.entity (verified against Razorpay's documented schema).
  const isRefundEvent = eventType.startsWith('refund.');
  const entity = isRefundEvent
    ? (body.payload && body.payload.refund && body.payload.refund.entity ? body.payload.refund.entity : null)
    : (body.payload && body.payload.payment && body.payload.payment.entity ? body.payload.payment.entity : null);
  if (!entity || typeof entity !== 'object') {
    return res.status(400).json({ success: false, message: 'Malformed webhook payload' });
  }

  const orderId = typeof entity.order_id === 'string' ? entity.order_id : null;
  // For refund events the Razorpay payment id arrives as payment_id and the
  // refund itself as id; for payment events the payment id arrives as id.
  const paymentRef = isRefundEvent
    ? (typeof entity.payment_id === 'string' ? entity.payment_id : null)
    : (typeof entity.id === 'string' ? entity.id : null);
  const refundRef = isRefundEvent && typeof entity.id === 'string' ? entity.id : null;

  // Idempotency claim (atomic via unique index on eventId). A duplicate key
  // means this exact event was already seen: acknowledge without reprocessing,
  // so retries can never duplicate tickets, notifications or transitions.
  let webhookEvent;
  try {
    webhookEvent = await PaymentWebhookEvent.create({
      eventId,
      eventType,
      status: 'received',
      razorpayOrderId: orderId || undefined,
      razorpayPaymentId: paymentRef || undefined
    });
  } catch (err) {
    if (err && err.code === 11000) {
      console.log('[PAYMENT WEBHOOK] Duplicate event ignored:', eventType, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: false, duplicate: true });
    }
    console.error('[PAYMENT WEBHOOK] Failed to record event:', eventType, 'event:', eventId);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }

  const failEvent = async (reason) => {
    try {
      webhookEvent.status = 'failed';
      webhookEvent.error = String(reason || 'reconciliation failed').slice(0, 200);
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
    } catch (_) { /* record-keeping must not mask the response */ }
  };

  try {
    // ---- Refund events: locate by Razorpay payment id (authoritative link
    // placed on the Payment row at capture/verify time), falling back to a
    // stored refund id for retries of an already-recorded refund.
    if (isRefundEvent) {
      if (!paymentRef) {
        await failEvent('Missing payment reference in refund payload');
        console.warn('[PAYMENT WEBHOOK] Missing payment reference:', eventType, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: false, reason: 'unknown_payment' });
      }

      if (eventType === 'refund.created') {
        // Informational only: a refund was opened, nothing is settled yet.
        webhookEvent.status = 'processed';
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();
        console.log('[PAYMENT WEBHOOK] Refund created (no state change):', paymentRef, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: false, reason: 'refund_created' });
      }

      let payment = await Payment.findOne({ razorpayPaymentId: paymentRef });
      if (!payment && refundRef) {
        payment = await Payment.findOne({ razorpayRefundId: refundRef });
      }
      if (!payment) {
        await failEvent('Unknown payment reference in refund payload');
        console.warn('[PAYMENT WEBHOOK] Payment not found for refund:', paymentRef, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: false, reason: 'unknown_payment' });
      }

      if (eventType === 'refund.failed') {
        // A failed refund must never downgrade state. If our stored refund
        // matches, the money did not move — flag loudly for manual review.
        if (payment.status === 'Refunded' && payment.razorpayRefundId && payment.razorpayRefundId === refundRef) {
          console.error('[PAYMENT WEBHOOK] Recorded refund reported FAILED by Razorpay — manual review required. payment:', String(payment._id), 'event:', eventId);
        } else {
          console.log('[PAYMENT WEBHOOK] Refund failure acknowledged (no state change):', paymentRef, 'event:', eventId);
        }
        webhookEvent.status = 'processed';
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();
        return res.json({ success: true, received: true, reconciled: false, reason: 'refund_failed_ack' });
      }

      // refund.processed — apply the same full-refund reconciliation as the
      // admin endpoint. Partial amounts are rejected: only a full refund of
      // the stored paid amount may transition a payment to Refunded.
      const expectedPaise = Math.round(Number(payment.amount || 0) * 100);
      const refundAmountPaise = Number(entity.amount);
      if (!Number.isFinite(expectedPaise) || !Number.isFinite(refundAmountPaise) || refundAmountPaise !== expectedPaise) {
        await failEvent('Refund amount mismatch (full refunds only)');
        console.warn('[PAYMENT WEBHOOK] Refund amount mismatch for payment:', paymentRef, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: false, reason: 'amount_mismatch' });
      }

      const { transitioned } = await applyRefundReconciliation(payment, { razorpayRefundId: refundRef });
      webhookEvent.status = 'processed';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
      console.log('[PAYMENT WEBHOOK] Reconciled refund.processed for payment:', paymentRef, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: transitioned, duplicate: !transitioned });
    }

    if (!orderId) {
      await failEvent('Missing order reference in webhook payload');
      console.warn('[PAYMENT WEBHOOK] Missing order reference:', eventType, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: false, reason: 'unknown_order' });
    }

    // The stored Payment row (created server-side by create-order) is the
    // authority binding order <-> registration <-> user <-> event. The
    // webhook can only ever update a known order; it can never create one.
    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      await failEvent('Unknown order ID');
      console.warn('[PAYMENT WEBHOOK] Payment not found for order:', orderId, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: false, reason: 'unknown_order' });
    }

    const registration = await Registration.findById(payment.registration).populate('event');
    if (!registration) {
      await failEvent('Associated registration not found');
      console.warn('[PAYMENT WEBHOOK] Registration not found for order:', orderId, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: false, reason: 'unknown_registration' });
    }

    if (eventType === 'payment.captured') {
      // Validate amount/currency against the stored record. The webhook is
      // never trusted to set the amount — mismatches are logged and ignored.
      const expectedPaise = Math.round(Number(payment.amount || 0) * 100);
      const entityCurrency = typeof entity.currency === 'string' ? entity.currency : null;
      if (!Number.isFinite(expectedPaise) || entity.amount !== expectedPaise || (entityCurrency && entityCurrency !== payment.currency)) {
        await failEvent('Amount or currency mismatch');
        console.warn('[PAYMENT WEBHOOK] Amount/currency mismatch for order:', orderId, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: false, reason: 'amount_mismatch' });
      }

      // Atomic compare-and-set: only Pending/Failed transition to Paid.
      // Already-Paid (e.g. client verification won the race) reconciles
      // to the same final state with no duplicate ticket or notifications.
      const transitioned = await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $in: ['Pending', 'Failed'] } },
        { $set: { status: 'Paid', razorpayPaymentId: paymentRef || payment.razorpayPaymentId, paidAt: new Date() } },
        { new: true }
      );
      if (!transitioned) {
        webhookEvent.status = 'processed';
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();
        console.log('[PAYMENT WEBHOOK] Already reconciled (no transition):', orderId, 'event:', eventId);
        return res.json({ success: true, received: true, reconciled: true, duplicate: true });
      }

      registration.paymentStatus = 'Paid';
      if (registration.status === 'Pending') {
        registration.status = 'Confirmed';
        if (!registration.ticketId) {
          registration.ticketId = await generateUniqueTicketId();
          registration.ticketIssuedAt = new Date();
        }
        if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
        registration.ticketStatus = 'Active';
      } else if (registration.status === 'Confirmed' && registration.ticketStatus !== 'Active') {
        if (!registration.ticketId) {
          registration.ticketId = await generateUniqueTicketId();
          registration.ticketIssuedAt = new Date();
        }
        registration.ticketStatus = 'Active';
        if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
      }
      await registration.save();

      const eventTitle = (registration.event && registration.event.title) || 'Event';
      await sendPaymentSuccessNotification(String(registration.user), eventTitle, transitioned.amount).catch(() => {});
      if (registration.ticketId && registration.ticketStatus === 'Active') {
        await sendTicketGeneratedNotification(String(registration.user), eventTitle, registration.ticketId).catch(() => {});
      }

      webhookEvent.status = 'processed';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
      console.log('[PAYMENT WEBHOOK] Reconciled payment.captured for order:', orderId, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: true });
    }

    // payment.failed — never downgrade an already-Paid record. A capture
    // arriving later can still legitimately transition Failed -> Paid.
    if (payment.status === 'Paid') {
      webhookEvent.status = 'processed';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
      console.log('[PAYMENT WEBHOOK] Ignored failure for already-Paid order:', orderId, 'event:', eventId);
      return res.json({ success: true, received: true, reconciled: true, duplicate: true });
    }

    const transitioned = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'Pending' },
      { $set: { status: 'Failed', failureReason: 'Payment failed at gateway' } },
      { new: true }
    );
    if (transitioned) {
      const eventTitle = (registration.event && registration.event.title) || 'Event';
      await sendPaymentFailedNotification(String(registration.user), eventTitle).catch(() => {});
    }
    webhookEvent.status = 'processed';
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    console.log('[PAYMENT WEBHOOK] Reconciled payment.failed for order:', orderId, 'event:', eventId);
    return res.json({ success: true, received: true, reconciled: true });
  } catch (err) {
    // Transient/internal problem: non-2xx so Razorpay retries delivery.
    console.error('[PAYMENT WEBHOOK] Processing error:', eventType, 'event:', eventId, '-', err.message || err);
    try {
      webhookEvent.status = 'failed';
      webhookEvent.error = String((err && err.message) || 'processing error').slice(0, 200);
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
    } catch (_) { /* ignore */ }
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// POST /api/payments/:paymentId/refund - ADMIN ONLY.
// Issues a real, FULL Razorpay refund for a Paid payment. The refund amount
// always comes from the stored Payment record — the request body cannot set
// or override it (an optional short `reason` is accepted for the audit log
// only and is never forwarded to Razorpay unvalidated).
// Idempotency: an atomic claim (status Paid + no refund yet) guarantees a
// single Razorpay refund even under concurrent admin requests; repeats get
// an idempotent success response. The database is marked Refunded only after
// Razorpay accepts the refund — never on frontend success, never on failure.
const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ success: false, message: 'Valid payment ID is required' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'Refunded') {
      return res.json({
        success: true,
        message: 'Payment is already refunded',
        data: {
          alreadyRefunded: true,
          paymentId: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          razorpayRefundId: payment.razorpayRefundId || null,
          refundedAt: payment.refundedAt || null
        }
      });
    }

    if (payment.status !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: `Only Paid payments can be refunded (current status: ${payment.status})`
      });
    }

    if (!payment.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'This payment has no Razorpay payment reference and cannot be refunded'
      });
    }

    const registration = await Registration.findById(payment.registration).populate('event');
    if (!registration) {
      return res.status(400).json({
        success: false,
        message: 'Associated registration not found; refund refused'
      });
    }

    // Atomic single-flight claim: exactly one concurrent request proceeds to
    // Razorpay. Losers re-read state: Refunded -> idempotent success,
    // otherwise a conflicting refund is already in progress.
    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'Paid', refundedAt: { $exists: false } },
      { $set: { refundedAt: new Date() } },
      { new: true }
    );
    if (!claimed) {
      const current = await Payment.findById(payment._id).select('status razorpayRefundId refundedAt amount currency').lean();
      if (current && current.status === 'Refunded') {
        return res.json({
          success: true,
          message: 'Payment is already refunded',
          data: {
            alreadyRefunded: true,
            paymentId: current._id,
            status: current.status,
            amount: current.amount,
            currency: current.currency,
            razorpayRefundId: current.razorpayRefundId || null,
            refundedAt: current.refundedAt || null
          }
        });
      }
      return res.status(409).json({
        success: false,
        message: 'A refund for this payment is already in progress. Please try again shortly.'
      });
    }

    const releaseClaim = async () => {
      try {
        await Payment.updateOne({ _id: payment._id }, { $unset: { refundedAt: '' } });
      } catch (_) { /* ignore */ }
    };

    // Mock/dev orders have no gateway counterpart and can never be refunded
    // for real. Refuse loudly instead of fabricating a refund.
    if (typeof payment.razorpayOrderId === 'string' && payment.razorpayOrderId.startsWith('order_mock_')) {
      await releaseClaim();
      return res.status(400).json({
        success: false,
        message: 'Development mock payments cannot be refunded. Refunds require a real Razorpay payment.'
      });
    }

    const reason = typeof (req.body && req.body.reason) === 'string'
      ? req.body.reason.trim().slice(0, 200)
      : '';
    const refundPaise = Math.round(Number(payment.amount || 0) * 100);
    if (!Number.isFinite(refundPaise) || refundPaise <= 0) {
      await releaseClaim();
      return res.status(400).json({ success: false, message: 'Stored payment amount is invalid; refund refused' });
    }

    let refund;
    try {
      const instance = getRazorpayInstance();
      refund = await instance.payments.refund(payment.razorpayPaymentId, { amount: refundPaise });
    } catch (rzErr) {
      await releaseClaim();
      console.error('[PAYMENT REFUND] Razorpay refund failed for payment:', String(payment._id), '-', rzErr.message || rzErr);
      return res.status(502).json({
        success: false,
        message: 'Razorpay could not process the refund. The payment remains Paid; no records were changed.'
      });
    }

    const razorpayRefundId = refund && typeof refund.id === 'string' ? refund.id : null;
    if (!razorpayRefundId) {
      await releaseClaim();
      console.error('[PAYMENT REFUND] Razorpay returned no refund identifier for payment:', String(payment._id));
      return res.status(502).json({
        success: false,
        message: 'Razorpay did not confirm the refund. The payment remains Paid; no records were changed.'
      });
    }

    const { transitioned } = await applyRefundReconciliation(payment, { razorpayRefundId });

    // Safe audit trail: identifiers, roles and amounts only. Never secrets,
    // signatures, tokens, phone numbers or raw payloads.
    console.log(
      `ADMIN_REFUND_REQUESTED admin=${req.user._id} payment=${payment._id} ` +
      `registration=${registration._id} event=${registration.event && (registration.event._id || registration.event)} ` +
      `amount=${payment.amount} refundId=${razorpayRefundId}` +
      (reason ? ` reason=${reason}` : '') +
      (transitioned ? '' : ' (already reconciled)')
    );

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        paymentId: payment._id,
        status: 'Refunded',
        amount: payment.amount,
        currency: payment.currency,
        razorpayRefundId,
        refundedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Refund payment error:', err);
    res.status(500).json({ success: false, message: 'Server error processing refund' });
  }
};

// GET /api/payments/registration/:registrationId - owner or admin
const getPaymentByRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }

    const query = { registration: registrationId };
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const payment = await Payment.findOne(query)
      .populate('user', 'name email')
      .populate('event', 'title category');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payment found for this registration' });
    }

    res.json({ success: true, data: payment });
  } catch (err) {
    console.error('Get payment error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching payment' });
  }
};

// GET /api/payments/my - user's payments
const getMyPayments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('event', 'title category imageUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Get my payments error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching payments' });
  }
};

module.exports = { createPaymentOrder, verifyPayment, handlePaymentWebhook, refundPayment, getPaymentByRegistration, getMyPayments };
