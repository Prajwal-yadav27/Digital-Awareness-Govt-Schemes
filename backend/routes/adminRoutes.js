const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAdminOverview, updateUserRole } = require('../controllers/adminController');

router.get('/', protect, authorize('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Admin route accessed successfully',
    data: { user: req.user }
  });
});

router.get('/overview', protect, authorize('admin'), getAdminOverview);

// PATCH /api/admin/users/:id/role - admin-only organizer provisioning.
// Allowlist is strictly user <-> organizer; admin role can never be granted here.
router.patch('/users/:id/role', protect, authorize('admin'), updateUserRole);

module.exports = router;
