const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { sendEventReminderNotification } = require('../utils/notificationService');

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60 * 1000;
const REMINDER_WINDOW_HOURS = 24; // Send reminder 24 hours before event

const processEventReminders = async (now = new Date()) => {
  const result = { checkedAt: now, eventsFound: 0, notificationsCreated: 0, events: [] };
  const reminderThreshold = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  // Find approved events happening within the reminder window
  const upcomingEvents = await Event.find({
    status: 'Approved',
    eventDate: { $gt: now, $lte: reminderThreshold },
    reminderNotifiedAt: null
  }).select('_id title eventDate').lean();

  for (const event of upcomingEvents) {
    // Find confirmed registrations for this event
    const registrations = await Registration.find({
      event: event._id,
      status: 'Confirmed'
    }).select('user numberOfGuests').lean();

    if (registrations.length === 0) continue;

    let created = 0;
    const hoursUntilEvent = Math.ceil((event.eventDate - now) / (1000 * 60 * 60));

    for (const reg of registrations) {
      // Per-user duplicate protection
      const Notification = require('../models/Notification');
      const exists = await Notification.findOne({
        user: reg.user,
        type: 'EVENT_REMINDER',
        relatedEvent: event._id
      }).select('_id').lean();
      if (exists) continue;

      await sendEventReminderNotification(reg.user, event.title, event.eventDate);
      created += 1;
    }

    // Mark as notified
    await Event.updateOne({ _id: event._id }, { $set: { reminderNotifiedAt: now } });

    result.eventsFound += 1;
    result.notificationsCreated += created;
    result.events.push({ eventId: String(event._id), title: event.title, notifiedUsers: created, hoursUntilEvent });
  }

  return result;
};

const runJobCycle = () => {
  processEventReminders(new Date()).catch((err) => {
    console.error('Event reminder job failed:', err.message || err);
  });
};

const startEventReminderJob = (intervalMs) => {
  const ms = Number(process.env.EVENT_REMINDER_INTERVAL_MS) || intervalMs || DEFAULT_INTERVAL_MS;
  const initial = setTimeout(runJobCycle, STARTUP_DELAY_MS);
  if (typeof initial.unref === 'function') initial.unref();
  const timer = setInterval(runJobCycle, ms);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`Event reminder job scheduled every ${ms}ms`);
  return timer;
};

module.exports = { processEventReminders, startEventReminderJob };