const nodemailer = require('nodemailer');

let transporter = null;
let transporterVerified = false;

// Production logging rule: this module never logs SMTP credentials or any
// credential metadata (no password value, length, existence, or formatting
// details). Operational logs carry only host/port/mode and error codes.
const isEmailConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

const getTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn('[Mailer] Email service is not configured (missing SMTP settings). Password reset emails will be unavailable until configured.');
    return null;
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = String(process.env.SMTP_PORT) === '465';

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection on first use (error code/message only — no payload dump).
    transporter.verify().then(() => {
      transporterVerified = true;
      console.log('[Mailer] SMTP connection verified successfully');
    }).catch((err) => {
      console.error('[Mailer] SMTP verification failed:', (err && err.code) || 'UNKNOWN');
    });
  }
  return transporter;
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const transport = getTransporter();
  if (!transport) {
    const err = new Error('Email service is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  if (!transporterVerified) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from,
    to,
    subject: 'GovSchemes Portal — Password Reset Request',
    text:
      `Hello ${name || 'there'},\n\n` +
      `We received a request to reset the password for your GovSchemes Portal account.\n\n` +
      `Reset your password using the link below (valid for 20 minutes, single use):\n${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email.\n\n` +
      `— GovSchemes Portal`,
    html:
      `<p>Hello ${name || 'there'},</p>` +
      `<p>We received a request to reset the password for your <strong>GovSchemes Portal</strong> account.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a> (valid for 20 minutes, single use).</p>` +
      `<p>If you did not request this, you can safely ignore this email.</p>` +
      `<p>— GovSchemes Portal</p>`
  });
};

module.exports = { isEmailConfigured, sendPasswordResetEmail };
