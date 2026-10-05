const Scheme = require('../models/Scheme');
const Bookmark = require('../models/Bookmark');
const Notification = require('../models/Notification');
const { sendSchemeExpiredNotification, sendSchemeDeadlineNotification } = require('../utils/notificationService');

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60 * 1000;
const DEADLINE_WINDOW_DAYS = 7;

// Expiry rule: a scheme is expired when endDate < now (Date objects, UTC instants).
// Schemes without endDate are never expired. Status is intentionally NOT rewritten:
// expiry is derived, and the admin's Active/Inactive/Draft choice is preserved.
const processSchemeExpiries = async (now = new Date()) => {
  const result = { checkedAt: now, expiredFound: 0, notificationsCreated: 0, schemes: [] };

  // Process expired schemes (endDate has passed)
  const expired = await Scheme.find({
    endDate: { $lte: now },
    expiryNotifiedAt: null
  }).select('_id title endDate').lean();

  for (const scheme of expired) {
    const bookmarks = await Bookmark.find({ scheme: scheme._id }).select('user').lean();
    let created = 0;
    const shortTitle = String(scheme.title || 'Scheme').slice(0, 120);

    for (const bm of bookmarks) {
      // Per-user duplicate protection: never notify the same user twice for one scheme.
      const exists = await Notification.findOne({
        user: bm.user,
        type: 'SCHEME_EXPIRED',
        relatedScheme: scheme._id
      }).select('_id').lean();
      if (exists) continue;

      await sendSchemeExpiredNotification(bm.user, shortTitle);
      created += 1;
    }

    // Mark the scheme as processed so re-runs never duplicate notifications.
    await Scheme.updateOne({ _id: scheme._id }, { $set: { expiryNotifiedAt: now } });

    result.expiredFound += 1;
    result.notificationsCreated += created;
    result.schemes.push({ schemeId: String(scheme._id), title: scheme.title, notifiedUsers: created });
  }

  return result;
};

// Process scheme deadline notifications (approaching endDate)
const processSchemeDeadlines = async (now = new Date()) => {
  const result = { checkedAt: now, deadlineFound: 0, notificationsCreated: 0, schemes: [] };
  const deadlineThreshold = new Date(now.getTime() + DEADLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Find schemes with endDate within the deadline window that haven't been notified yet
  const upcoming = await Scheme.find({
    endDate: { $gt: now, $lte: deadlineThreshold },
    deadlineNotifiedAt: null,
    status: 'Active'
  }).select('_id title endDate').lean();

  for (const scheme of upcoming) {
    const bookmarks = await Bookmark.find({ scheme: scheme._id }).select('user').lean();
    let created = 0;

    for (const bm of bookmarks) {
      // Per-user duplicate protection
      const exists = await Notification.findOne({
        user: bm.user,
        type: 'SCHEME_DEADLINE',
        relatedScheme: scheme._id
      }).select('_id').lean();
      if (exists) continue;

      await sendSchemeDeadlineNotification(bm.user, scheme.title, scheme.endDate);
      created += 1;
    }

    // Mark as notified for this deadline window
    await Scheme.updateOne({ _id: scheme._id }, { $set: { deadlineNotifiedAt: now } });

    result.deadlineFound += 1;
    result.notificationsCreated += created;
    result.schemes.push({ schemeId: String(scheme._id), title: scheme.title, notifiedUsers: created, deadlineDays: Math.ceil((scheme.endDate - now) / (24 * 60 * 60 * 1000)) });
  }

  return result;
};

const runJobCycle = () => {
  const now = new Date();
  processSchemeExpiries(now).catch((err) => {
    console.error('Scheme expiry job failed:', err.message || err);
  });
  processSchemeDeadlines(now).catch((err) => {
    console.error('Scheme deadline job failed:', err.message || err);
  });
};

// Lightweight scheduler: single setInterval, no Redis/BullMQ/Kafka.
// Interval override via SCHEME_EXPIRY_INTERVAL_MS (ms). Timer is unref'd so it
// never keeps the process alive on its own.
const startSchemeExpiryJob = (intervalMs) => {
  const ms = Number(process.env.SCHEME_EXPIRY_INTERVAL_MS) || intervalMs || DEFAULT_INTERVAL_MS;
  const initial = setTimeout(runJobCycle, STARTUP_DELAY_MS);
  if (typeof initial.unref === 'function') initial.unref();
  const timer = setInterval(runJobCycle, ms);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`Scheme expiry/deadline job scheduled every ${ms}ms`);
  return timer;
};

module.exports = { processSchemeExpiries, processSchemeDeadlines, startSchemeExpiryJob };
