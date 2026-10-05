const EventReview = require('../models/EventReview');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');

const extractValidationErrors = (err) => {
  if (err.name !== 'ValidationError') return null;
  const errors = {};
  for (const field in err.errors) errors[field] = err.errors[field].message;
  return { message: Object.values(errors)[0] || 'Validation failed', errors };
};

// POST /api/event-reviews - user with Confirmed registration
const createReview = async (req, res) => {
  try {
    const { eventId, rating, comment } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }
    const numRating = Number(rating);
    if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    const event = await Event.findById(eventId).select('_id status');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Verify user has a Confirmed registration for this event
    const registration = await Registration.findOne({
      user: req.user._id,
      event: eventId,
      status: 'Confirmed'
    });
    if (!registration) {
      return res.status(403).json({ success: false, message: 'Reviews are available after confirming this event' });
    }

    // Check duplicate
    const existing = await EventReview.findOne({ user: req.user._id, event: eventId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this event' });
    }

    const review = new EventReview({
      user: req.user._id,
      event: eventId,
      registration: registration._id,
      rating: numRating,
      comment: typeof comment === 'string' ? comment.trim().slice(0, 1000) : ''
    });

    await review.save();
    await review.populate('user', 'name profileImage');

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this event' });
    }
    const validation = extractValidationErrors(err);
    if (validation) return res.status(400).json({ success: false, ...validation });
    console.error('Create review error:', err);
    res.status(500).json({ success: false, message: 'Server error creating review' });
  }
};

// GET /api/event-reviews/event/:eventId - public
const getEventReviews = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId format' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total, summaryAgg] = await Promise.all([
      EventReview.find({ event: eventId })
        .populate('user', 'name profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventReview.countDocuments({ event: eventId }),
      EventReview.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 }, distribution: { $push: '$rating' } } }
      ])
    ]);

    let summary = { averageRating: 0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    if (summaryAgg[0]) {
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      (summaryAgg[0].distribution || []).forEach(r => { if (dist[r] !== undefined) dist[r]++; });
      summary = {
        averageRating: Math.round(summaryAgg[0].avgRating * 10) / 10,
        totalReviews: summaryAgg[0].totalReviews,
        distribution: dist
      };
    }

    res.json({
      success: true,
      data: reviews,
      summary,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Get event reviews error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching reviews' });
  }
};

// GET /api/event-reviews/my/:eventId - user's own review
const getMyEventReview = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId format' });
    }
    const review = await EventReview.findOne({ user: req.user._id, event: eventId }).lean();
    res.json({ success: true, data: review || null });
  } catch (err) {
    console.error('Get my review error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching your review' });
  }
};

// PUT /api/event-reviews/:id - owner only
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID format' });
    }
    const review = await EventReview.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (String(review.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this review' });
    }

    if (req.body.rating !== undefined) {
      const numRating = Number(req.body.rating);
      if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }
      review.rating = numRating;
    }
    if (req.body.comment !== undefined) review.comment = String(req.body.comment).trim().slice(0, 1000);

    await review.save();
    await review.populate('user', 'name profileImage');
    res.json({ success: true, data: review });
  } catch (err) {
    const validation = extractValidationErrors(err);
    if (validation) return res.status(400).json({ success: false, ...validation });
    console.error('Update review error:', err);
    res.status(500).json({ success: false, message: 'Server error updating review' });
  }
};

// DELETE /api/event-reviews/:id - owner or admin
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID format' });
    }
    const review = await EventReview.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const isOwner = String(review.user) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
    }

    await EventReview.findByIdAndDelete(id);
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting review' });
  }
};

module.exports = { createReview, getEventReviews, getMyEventReview, updateReview, deleteReview };
