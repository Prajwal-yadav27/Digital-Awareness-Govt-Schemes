const express = require('express');
const router = express.Router();
const {
  createRegistration,
  getMyRegistrations,
  getRegistrationById,
  cancelRegistration,
  getEventRegistrations,
  updateRegistrationStatus,
  getTicket,
  verifyTicket,
  checkInTicket
} = require('../controllers/registrationController');
const { protect, authorize, verifiedOrganizer } = require('../middleware/authMiddleware');
const { registrationLimiter, verificationLimiter } = require('../middleware/rateLimitMiddleware');

// POST /api/registrations - user only
router.post('/', protect, authorize('user'), registrationLimiter, createRegistration);

// GET /api/registrations/my - must be before /:id
router.get('/my', protect, authorize('user'), getMyRegistrations);

// GET /api/registrations/verify/:ticketId - must be before /:id
router.get('/verify/:ticketId', protect, verifiedOrganizer('organizer', 'admin'), verificationLimiter, verifyTicket);

// GET /api/registrations/event/:eventId - must be before /:id
router.get('/event/:eventId', protect, verifiedOrganizer('organizer', 'admin'), getEventRegistrations);

// GET /api/registrations/:id/ticket - must be before /:id
router.get('/:id/ticket', protect, getTicket);

// GET /api/registrations/:id - protected, role check inside controller
router.get('/:id', protect, getRegistrationById);

// PATCH /api/registrations/:id/cancel - user only
router.patch('/:id/cancel', protect, authorize('user'), cancelRegistration);

// PATCH /api/registrations/:id/status - organizer/admin
router.patch('/:id/status', protect, verifiedOrganizer('organizer', 'admin'), updateRegistrationStatus);

// PATCH /api/registrations/verify/:ticketId/check-in - organizer/admin
router.patch('/verify/:ticketId/check-in', protect, verifiedOrganizer('organizer', 'admin'), verificationLimiter, checkInTicket);

module.exports = router;
