const User = require('../models/User');
const { createNotification } = require('../controllers/notificationController');
const { sendPasswordResetEmail, isEmailConfigured } = require('./mailer');
const { sendSms, isSmsConfigured, normalizePhone } = require('./sms');

const NOTIFICATION_CHANNELS = {
  IN_APP: 'inApp',
  EMAIL: 'email',
  SMS: 'sms'
};

const CHANNEL_CONFIG = {
  PASSWORD_RESET: {
    [NOTIFICATION_CHANNELS.IN_APP]: false,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  SCHEME_DEADLINE: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  SCHEME_EXPIRED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  EVENT_REGISTRATION: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  EVENT_REMINDER: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  EVENT_CANCELLED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  EVENT_UPDATED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  EVENT_APPROVED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  EVENT_REJECTED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  EVENT_PENDING: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  REGISTRATION_CONFIRMED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  REGISTRATION_REJECTED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  REGISTRATION_CANCELLED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  PAYMENT_SUCCESS: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  PAYMENT_FAILED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  PAYMENT_REFUNDED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  TICKET_GENERATED: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: true
  },
  CHECK_IN_SUCCESS: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: false,
    [NOTIFICATION_CHANNELS.SMS]: false
  },
  ADMIN_ANNOUNCEMENT: {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: false,
    [NOTIFICATION_CHANNELS.SMS]: false
  }
};

const getChannelsForType = (type, userPreferences) => {
  const defaultConfig = CHANNEL_CONFIG[type] || {
    [NOTIFICATION_CHANNELS.IN_APP]: true,
    [NOTIFICATION_CHANNELS.EMAIL]: true,
    [NOTIFICATION_CHANNELS.SMS]: false
  };

  return {
    [NOTIFICATION_CHANNELS.IN_APP]: defaultConfig[NOTIFICATION_CHANNELS.IN_APP] && userPreferences?.inApp !== false,
    [NOTIFICATION_CHANNELS.EMAIL]: defaultConfig[NOTIFICATION_CHANNELS.EMAIL] && userPreferences?.email !== false,
    [NOTIFICATION_CHANNELS.SMS]: defaultConfig[NOTIFICATION_CHANNELS.SMS] && userPreferences?.sms === true
  };
};

const canSendSms = (user) => {
  return user?.phone
    && user?.phoneVerified === true
    && user?.notificationPreferences?.sms === true
    && isSmsConfigured();
};

const sendInAppNotification = async ({ userId, type, title, message, relatedEvent, relatedScheme, relatedRegistration }) => {
  try {
    await createNotification({
      userId,
      type,
      title,
      message,
      relatedEvent,
      relatedScheme,
      relatedRegistration
    });
    return { success: true, channel: NOTIFICATION_CHANNELS.IN_APP };
  } catch (err) {
    console.warn('[NotificationService] In-app notification failed:', err.message);
    return { success: false, channel: NOTIFICATION_CHANNELS.IN_APP, error: err.message };
  }
};

const sendEmailNotification = async ({ to, name, subject, html, text }) => {
  if (!isEmailConfigured()) {
    return { success: false, channel: NOTIFICATION_CHANNELS.EMAIL, error: 'Email not configured', skipped: true };
  }
  if (!to) {
    return { success: false, channel: NOTIFICATION_CHANNELS.EMAIL, error: 'No recipient email', skipped: true };
  }

  try {
    const transport = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_PORT) === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: { rejectUnauthorized: false }
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
    return { success: true, channel: NOTIFICATION_CHANNELS.EMAIL };
  } catch (err) {
    console.warn('[NotificationService] Email notification failed:', err.code || err.message);
    return { success: false, channel: NOTIFICATION_CHANNELS.EMAIL, error: err.message };
  }
};

const sendSmsNotification = async ({ to, body }) => {
  if (!isSmsConfigured()) {
    return { success: false, channel: NOTIFICATION_CHANNELS.SMS, error: 'SMS not configured', skipped: true };
  }
  if (!to) {
    return { success: false, channel: NOTIFICATION_CHANNELS.SMS, error: 'No recipient phone', skipped: true };
  }

  try {
    const result = await sendSms({ to, body });
    return { success: true, channel: NOTIFICATION_CHANNELS.SMS, sid: result.sid };
  } catch (err) {
    console.warn('[NotificationService] SMS notification failed:', err.code || err.message);
    return { success: false, channel: NOTIFICATION_CHANNELS.SMS, error: err.message };
  }
};

const sendNotification = async ({ userId, type, title, message, relatedEvent, relatedScheme, relatedRegistration, emailData, smsData }) => {
  if (!userId) {
    console.warn('[NotificationService] No userId provided');
    return;
  }

  const user = await User.findById(userId).select('phone phoneVerified notificationPreferences email name').lean();
  if (!user) {
    console.warn('[NotificationService] User not found:', userId);
    return;
  }

  const channels = getChannelsForType(type, user.notificationPreferences);
  const results = {};

  const promises = [];

  if (channels[NOTIFICATION_CHANNELS.IN_APP]) {
    promises.push(
      sendInAppNotification({ userId, type, title, message, relatedEvent, relatedScheme, relatedRegistration })
        .then(r => { results[NOTIFICATION_CHANNELS.IN_APP] = r; })
    );
  }

  if (channels[NOTIFICATION_CHANNELS.EMAIL] && user.email) {
    const emailSubject = emailData?.subject || title;
    const emailHtml = emailData?.html || `<p>${message}</p>`;
    const emailText = emailData?.text || message;

    promises.push(
      sendEmailNotification({
        to: user.email,
        name: user.name,
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      }).then(r => { results[NOTIFICATION_CHANNELS.EMAIL] = r; })
    );
  }

  if (channels[NOTIFICATION_CHANNELS.SMS] && canSendSms(user)) {
    const smsBody = smsData?.body || `${title}: ${message}`;
    promises.push(
      sendSmsNotification({ to: user.phone, body: smsBody })
        .then(r => { results[NOTIFICATION_CHANNELS.SMS] = r; })
    );
  }

  await Promise.allSettled(promises);

  const successful = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => r.success === false && !r.skipped).length;

  if (failed > 0 && successful === 0) {
    console.warn('[NotificationService] All channels failed for user:', userId, 'type:', type);
  }

  return results;
};

const sendSchemeDeadlineNotification = async (userId, schemeTitle, deadline) => {
  return sendNotification({
    userId,
    type: 'SCHEME_DEADLINE',
    title: 'Scheme Deadline Approaching',
    message: `The application deadline for "${schemeTitle}" is approaching on ${new Date(deadline).toLocaleDateString('en-IN')}. Please apply soon.`,
    smsData: {
      body: `GovSchemes Portal: Deadline for "${schemeTitle}" is approaching on ${new Date(deadline).toLocaleDateString('en-IN')}. Apply now.`
    }
  });
};

const sendSchemeExpiredNotification = async (userId, schemeTitle) => {
  return sendNotification({
    userId,
    type: 'SCHEME_EXPIRED',
    title: 'Government Scheme Expired',
    message: `Your bookmarked scheme "${schemeTitle}" has reached its application end date and is no longer active.`
  });
};

const sendEventRegistrationNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'EVENT_REGISTRATION',
    title: 'Registration Submitted',
    message: `You have successfully registered for "${eventTitle}".`,
    smsData: {
      body: `GovSchemes Portal: You have successfully registered for "${eventTitle}".`
    }
  });
};

const sendEventReminderNotification = async (userId, eventTitle, eventDate) => {
  return sendNotification({
    userId,
    type: 'EVENT_REMINDER',
    title: 'Event Reminder',
    message: `Reminder: "${eventTitle}" is scheduled for ${new Date(eventDate).toLocaleDateString('en-IN')}.`,
    smsData: {
      body: `GovSchemes Portal: Reminder — "${eventTitle}" is on ${new Date(eventDate).toLocaleDateString('en-IN')}. Check your registration.`
    }
  });
};

const sendEventCancelledNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'EVENT_CANCELLED',
    title: 'Event Cancelled',
    message: `The event "${eventTitle}" has been cancelled.`,
    smsData: {
      body: `GovSchemes Portal: "${eventTitle}" has been cancelled. Check the portal for details.`
    }
  });
};

const sendEventUpdatedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'EVENT_UPDATED',
    title: 'Event Updated',
    message: `The event "${eventTitle}" has been updated. Please check the details.`
  });
};

const sendEventApprovedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'EVENT_APPROVED',
    title: 'Event Approved',
    message: `"${eventTitle}" has been approved and is now visible to the public.`
  });
};

const sendEventRejectedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'EVENT_REJECTED',
    title: 'Event Rejected',
    message: `"${eventTitle}" was rejected by the admin.`
  });
};

const sendRegistrationConfirmedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'REGISTRATION_CONFIRMED',
    title: 'Registration Confirmed',
    message: `Your registration for "${eventTitle}" has been confirmed.`,
    smsData: {
      body: `GovSchemes Portal: Your registration for "${eventTitle}" is confirmed.`
    }
  });
};

const sendRegistrationRejectedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'REGISTRATION_REJECTED',
    title: 'Registration Rejected',
    message: `Your registration for "${eventTitle}" was rejected.`,
    smsData: {
      body: `GovSchemes Portal: Your registration for "${eventTitle}" was rejected.`
    }
  });
};

const sendRegistrationCancelledNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'REGISTRATION_CANCELLED',
    title: 'Registration Cancelled',
    message: `Your registration for "${eventTitle}" has been cancelled.`,
    smsData: {
      body: `GovSchemes Portal: Your registration for "${eventTitle}" is cancelled.`
    }
  });
};

const sendPaymentSuccessNotification = async (userId, eventTitle, amount) => {
  return sendNotification({
    userId,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Successful',
    message: `Your payment of ₹${amount} for "${eventTitle}" was successful.`,
    smsData: {
      body: `GovSchemes Portal: Payment of ₹${amount} for "${eventTitle}" successful.`
    }
  });
};

const sendPaymentFailedNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'PAYMENT_FAILED',
    title: 'Payment Failed',
    message: `Your payment for "${eventTitle}" could not be processed. Please try again.`,
    smsData: {
      body: `GovSchemes Portal: Payment for "${eventTitle}" failed. Please try again.`
    }
  });
};

const sendPaymentRefundedNotification = async (userId, eventTitle, amount) => {
  return sendNotification({
    userId,
    type: 'PAYMENT_REFUNDED',
    title: 'Payment Refunded',
    message: `Your payment of ₹${amount} for "${eventTitle}" has been refunded.`,
    smsData: {
      body: `GovSchemes Portal: Payment of ₹${amount} for "${eventTitle}" has been refunded.`
    }
  });
};

const sendTicketGeneratedNotification = async (userId, eventTitle, ticketId) => {
  return sendNotification({
    userId,
    type: 'TICKET_GENERATED',
    title: 'Ticket Generated',
    message: `Your ticket (${ticketId}) for "${eventTitle}" has been generated.`,
    smsData: {
      body: `GovSchemes Portal: Ticket ${ticketId} for "${eventTitle}" generated.`
    }
  });
};

const sendCheckInSuccessNotification = async (userId, eventTitle) => {
  return sendNotification({
    userId,
    type: 'CHECK_IN_SUCCESS',
    title: 'Checked In Successfully',
    message: `You have been checked in for "${eventTitle}". Enjoy the event!`
  });
};

const sendAdminAnnouncementNotification = async (userId, title, message) => {
  return sendNotification({
    userId,
    type: 'ADMIN_ANNOUNCEMENT',
    title,
    message
  });
};

const sendEventPendingNotification = async (userId, eventTitle, organizerName) => {
  return sendNotification({
    userId,
    type: 'EVENT_PENDING',
    title: 'New Event Pending Approval',
    message: `"${eventTitle}" was submitted by ${organizerName} and is waiting for admin approval.`
  });
};

module.exports = {
  sendNotification,
  sendSchemeDeadlineNotification,
  sendSchemeExpiredNotification,
  sendEventRegistrationNotification,
  sendEventReminderNotification,
  sendEventCancelledNotification,
  sendEventUpdatedNotification,
  sendEventApprovedNotification,
  sendEventRejectedNotification,
  sendEventPendingNotification,
  sendRegistrationConfirmedNotification,
  sendRegistrationRejectedNotification,
  sendRegistrationCancelledNotification,
  sendPaymentSuccessNotification,
  sendPaymentFailedNotification,
  sendPaymentRefundedNotification,
  sendTicketGeneratedNotification,
  sendCheckInSuccessNotification,
  sendAdminAnnouncementNotification,
  NOTIFICATION_CHANNELS,
  CHANNEL_CONFIG,
  getChannelsForType,
  canSendSms
};