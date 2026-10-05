const express = require('express');
const router = express.Router();
const { createReview, getEventReviews, getMyEventReview, updateReview, deleteReview } = require('../controllers/eventReviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('user'), createReview);
router.get('/event/:eventId', getEventReviews);
router.get('/my/:eventId', protect, authorize('user'), getMyEventReview);
router.put('/:id', protect, authorize('user'), updateReview);
router.delete('/:id', protect, authorize('user', 'admin'), deleteReview);

module.exports = router;
