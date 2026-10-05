const User = require('../models/User');
const Scheme = require('../models/Scheme');
const Bookmark = require('../models/Bookmark');

const getAdminOverview = async (_req, res) => {
  try {
    const [
      totalSchemes,
      totalUsers,
      centralSchemes,
      stateSchemes,
      totalBookmarks,
      activeSchemes,
      draftSchemes,
      inactiveSchemes,
      totalApplicationsAgg,
      schemesByCategoryRaw,
      mostApplied,
      mostBookmarkedRaw,
      recentSchemes,
      recentUpdated,
      creationTrendRaw
    ] = await Promise.all([
      Scheme.countDocuments(),
      User.countDocuments(),
      Scheme.countDocuments({ sourceType: 'CENTRAL' }),
      Scheme.countDocuments({ sourceType: 'STATE' }),
      Bookmark.countDocuments(),
      Scheme.countDocuments({ status: 'Active' }),
      Scheme.countDocuments({ status: 'Draft' }),
      Scheme.countDocuments({ status: 'Inactive' }),
      Scheme.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$applyCount' }
          }
        }
      ]),
      Scheme.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]),
      Scheme.find().sort({ applyCount: -1 }).limit(5).select('title category applyCount').lean(),
      Bookmark.aggregate([
        {
          $group: {
            _id: '$scheme',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        },
        {
          $lookup: {
            from: 'schemes',
            localField: '_id',
            foreignField: '_id',
            as: 'scheme'
          }
        },
        {
          $unwind: '$scheme'
        }
      ]),
      Scheme.find().sort({ createdAt: -1 }).limit(5).select('title category sourceType state status createdAt').lean(),
      Scheme.find().sort({ updatedAt: -1 }).limit(5).select('title category sourceType state status updatedAt').lean(),
      Scheme.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: {
            '_id.year': 1,
            '_id.month': 1
          }
        }
      ])
    ]);

    const totalApplications = totalApplicationsAgg[0]?.total ?? 0;

    const schemesByCategory = (schemesByCategoryRaw || []).map((item) => ({
      category: item._id,
      count: item.count
    }));

    const mostBookmarked = (mostBookmarkedRaw || []).map((item) => ({
      _id: item._id,
      title: item.scheme?.title || 'Unknown',
      category: item.scheme?.category || 'Uncategorized',
      bookmarkCount: item.count
    }));

    const creationTrend = (creationTrendRaw || []).map((item) => ({
      year: item._id.year,
      month: item._id.month,
      count: item.count
    }));

    res.json({
      success: true,
      data: {
        totalSchemes: Number(totalSchemes || 0),
        totalUsers: Number(totalUsers || 0),
        centralSchemes: Number(centralSchemes || 0),
        stateSchemes: Number(stateSchemes || 0),
        totalBookmarks: Number(totalBookmarks || 0),
        activeSchemes: Number(activeSchemes || 0),
        draftSchemes: Number(draftSchemes || 0),
        inactiveSchemes: Number(inactiveSchemes || 0),
        totalApplications: Number(totalApplications || 0),
        schemesByCategory,
        mostApplied: mostApplied || [],
        mostBookmarked,
        recentSchemes: recentSchemes || [],
        recentUpdated: recentUpdated || [],
        creationTrend
      }
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load admin overview'
    });
  }
};

// PATCH /api/admin/users/:id/role — admin-only organizer provisioning.
// Strictly limited to the user <-> organizer transition:
// - allowlist: only 'user' and 'organizer' (never 'admin')
// - target must be a valid, existing, non-admin user
// - the acting admin cannot change their own role through this endpoint
// - promoting to organizer sets isOrganizerVerified=true;
//   demoting to user sets isOrganizerVerified=false
// - touches NOTHING else (no password/email/phone/preferences/JWT changes)
// - returns safe user fields only (never password/hash/tokens)
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const ALLOWED_ROLES = ['user', 'organizer'];
    if (!role || typeof role !== 'string' || !ALLOWED_ROLES.includes(role.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either "user" or "organizer"'
      });
    }
    const nextRole = role.trim();

    if (String(id) === String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot change your own role through this endpoint'
      });
    }

    const targetUser = await User.findById(id).select('-password');
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be modified through this endpoint'
      });
    }

    if (targetUser.role === nextRole) {
      return res.status(400).json({
        success: false,
        message: `User already has role "${nextRole}"`
      });
    }

    const previousRole = targetUser.role;
    targetUser.role = nextRole;
    targetUser.isOrganizerVerified = nextRole === 'organizer';
    await targetUser.save();

    // Safe audit trail: identifiers + roles only. Never passwords, tokens,
    // phone numbers, OTPs or other secrets.
    console.log(
      `ADMIN_ROLE_CHANGE admin=${req.user._id} target=${targetUser._id} from=${previousRole} to=${nextRole}`
    );

    res.json({
      success: true,
      message: nextRole === 'organizer'
        ? `User "${targetUser.name}" promoted to organizer`
        : `Organizer access removed from "${targetUser.name}"`,
      data: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isOrganizerVerified: targetUser.isOrganizerVerified
      }
    });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating user role'
    });
  }
};

module.exports = {
  getAdminOverview,
  updateUserRole
};
