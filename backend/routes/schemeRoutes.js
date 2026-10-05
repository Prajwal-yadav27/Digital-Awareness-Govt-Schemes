const express = require('express');
const router = express.Router();
const {
  createScheme,
  bulkCreateSchemes,
  getSchemes,
  getSchemeById,
  updateScheme,
  deleteScheme,
  getSchemeMetadata,
  recordApplyNow
} = require('../controllers/schemeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/metadata', getSchemeMetadata);
router.get('/', getSchemes);
router.get('/:id', getSchemeById);

// Public Apply-Now tracking (increments counter for analytics)
router.post('/:id/apply', recordApplyNow);

// Admin only routes
router.post('/', protect, authorize('admin'), createScheme);
router.post('/bulk', protect, authorize('admin'), bulkCreateSchemes);
router.put('/:id', protect, authorize('admin'), updateScheme);
router.delete('/:id', protect, authorize('admin'), deleteScheme);

module.exports = router;
