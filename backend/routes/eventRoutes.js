const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getOrganizerEvents,
  getAdminEvents,
  getAdminEventStats,
  getAdminEventMeta,
  updateEventStatus,
  getOrganizerAnalytics
} = require('../controllers/eventController');
const { protect, authorize, verifiedOrganizer } = require('../middleware/authMiddleware');
const { eventWriteLimiter } = require('../middleware/rateLimitMiddleware');

// Public
router.get('/', getEvents);

// Organizer - must be before /:id (verified organizers only; admins bypass)
router.get('/organizer', protect, verifiedOrganizer('organizer'), getOrganizerEvents);
router.get('/organizer/analytics', protect, verifiedOrganizer('organizer', 'admin'), getOrganizerAnalytics);

// Admin only - list all events including Pending/Rejected/Draft
router.get('/admin', protect, authorize('admin'), getAdminEvents);
router.get('/admin/stats', protect, authorize('admin'), getAdminEventStats);
router.get('/admin/meta', protect, authorize('admin'), getAdminEventMeta);

router.get('/:id', getEventById);

// Protected - verified Organizer & Admin (unverified organizers are rejected)
router.post('/', protect, verifiedOrganizer('organizer', 'admin'), eventWriteLimiter, createEvent);
router.put('/:id', protect, verifiedOrganizer('organizer', 'admin'), eventWriteLimiter, updateEvent);
router.delete('/:id', protect, verifiedOrganizer('organizer', 'admin'), eventWriteLimiter, deleteEvent);

// Admin only
router.patch('/:id/status', protect, authorize('admin'), eventWriteLimiter, updateEventStatus);

module.exports = router;
