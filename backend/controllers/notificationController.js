const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, isRead: false })
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      unreadCount
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching unread count' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    console.error('Mark as read error:', err);
    res.status(500).json({ success: false, message: 'Server error marking notification as read' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ success: false, message: 'Server error marking all notifications as read' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndDelete({ _id: id, user: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    console.error('Delete notification error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting notification' });
  }
};

// Helper function to create a notification (called from other controllers)
const createNotification = async ({ userId, type, title, message, relatedEvent, relatedRegistration, relatedScheme }) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      relatedEvent: relatedEvent || undefined,
      relatedRegistration: relatedRegistration || undefined,
      relatedScheme: relatedScheme || undefined
    });
    await notification.save();
  } catch (err) {
    console.warn('Failed to create notification:', err.message);
  }
};

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification, createNotification };
