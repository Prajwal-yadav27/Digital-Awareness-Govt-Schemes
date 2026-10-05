const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');
const Scheme = require('../models/Scheme');

const addBookmark = async (req, res) => {
  try {
    const { schemeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schemeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    const scheme = await Scheme.findById(schemeId);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    const existing = await Bookmark.findOne({
      user: req.user.id,
      scheme: schemeId
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Already bookmarked',
        data: existing
      });
    }

    const bookmark = await Bookmark.create({
      user: req.user.id,
      scheme: schemeId
    });

    return res.status(201).json({
      success: true,
      message: 'Scheme added to bookmarks',
      data: bookmark
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'Already bookmarked'
      });
    }
    console.error('Add bookmark error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error adding bookmark'
    });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ user: req.user.id })
      .populate('scheme', 'title category status imageUrl')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      message: 'Bookmarks retrieved',
      data: bookmarks
    });
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bookmarks'
    });
  }
};

const deleteBookmark = async (req, res) => {
  try {
    const { schemeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(schemeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    const bookmark = await Bookmark.findOne({
      user: req.user.id,
      scheme: schemeId
    });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      });
    }

    await Bookmark.deleteOne({
      user: req.user.id,
      scheme: schemeId
    });

    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    });

  } catch (err) {
    console.error('Delete bookmark error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error removing bookmark'
    });
  }
};
module.exports = {
  addBookmark,
  getBookmarks,
  deleteBookmark
};
