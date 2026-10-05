require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const schemeRoutes = require('./routes/schemeRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const eventReviewRoutes = require('./routes/eventReviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { protect } = require('./middleware/authMiddleware');
const sanitizeRequest = require('./middleware/sanitizeMiddleware');

const helmet = require('helmet');

const app = express();

// Trust one reverse proxy in front of the app so req.ip reflects the real
// client IP (required for the IP-based authLimiter to work correctly).
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : defaultAllowedOrigins;

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (health checks, server-to-server and
    // API clients) are allowed; browsers must match the configured allow-list.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));



app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      // Razorpay webhook signature verification requires the exact raw
      // request bytes. Stash them ONLY for the webhook path; every other
      // route keeps the normal parsed-JSON behavior unchanged.
      const webhookPath = (req.originalUrl || '').split('?')[0];
      if (webhookPath === '/api/payments/webhook') {
        req.rawBody = buf.toString(encoding || 'utf8');
      }
      JSON.parse(buf.toString(encoding));
    } catch (err) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON payload'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL injection / prototype-pollution protection (Express 5 compatible,
// read-only on req.query — never overwrites the getter-only property).
app.use(sanitizeRequest);

// Validate SMS configuration at startup. A mock/unknown SMS provider in
// production is a fatal misconfiguration (phone verification must use a
// real provider); missing credentials are non-fatal and SMS stays disabled.
try {
  const { validateSmsConfig } = require('./utils/sms');
  validateSmsConfig();
} catch (err) {
  console.error('[SMS] Startup validation failed:', err.code || err.message);
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    process.exit(1);
  }
}

// Production core-config guard: JWT signing and the database are
// non-optional. A missing/weak JWT_SECRET or missing MONGO_URI fails fast
// in production instead of producing unsigned/unusable auth or a late,
// confusing connection error. Nothing secret is ever logged here.
(() => {
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const problems = [];
  if (!process.env.MONGO_URI) problems.push('MONGO_URI is not set');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be set to a strong value (at least 32 characters)');
  }
  if (problems.length === 0) return;
  console.error('[CONFIG] Production configuration problem:', problems.join('; '));
  if (isProduction) process.exit(1);
})();

// NOTE: MongoDB connection is established in startServer() at the bottom of
// this file. The HTTP server only starts listening AFTER the database is
// connected, so requests can never hit Mongoose buffering timeouts during
// normal startup. Single connection; no duplication.

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Government Schemes Portal API is running',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API working correctly',
    data: {
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/event-reviews', eventReviewRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/protected', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Protected route accessed successfully',
    data: { user: req.user }
  });
});

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin not allowed'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload too large'
    });
  }

  // Never expose internal error details outside a development environment.
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    message: isDev ? `Server error: ${err.message}` : 'Something went wrong on the server'
  });
});

const PORT = process.env.PORT || 5000;

// Database-aware startup sequence:
//   env/config validation (above) -> MongoDB connect -> HTTP listen -> jobs.
// If the initial MongoDB connection fails, the HTTP server is never started
// and the process exits non-zero so the platform can restart the service.
// Post-startup, Mongoose keeps its default auto-reconnect behavior.
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully', 'DB_NAME=', mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown', 'NODE_ENV=', process.env.NODE_ENV || 'development');
  } catch (err) {
    console.error('MongoDB connection failed during startup — HTTP server will not start:', err && err.message ? err.message : err);
    process.exit(1);
    return;
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api`);
    console.log(`Health:  http://localhost:${PORT}/api/health`);

    // Scheduled jobs start exactly once, only after DB + HTTP are ready.
    try {
      const { startSchemeExpiryJob } = require('./utils/schemeExpiryJob');
      startSchemeExpiryJob();
    } catch (err) {
      console.error('Failed to start scheme expiry job:', err.message || err);
    }
    try {
      const { startEventReminderJob } = require('./utils/eventReminderJob');
      startEventReminderJob();
    } catch (err) {
      console.error('Failed to start event reminder job:', err.message || err);
    }
  });
};

startServer();
