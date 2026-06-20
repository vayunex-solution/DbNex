require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { prisma } = require('./config/database');

// ── Route Imports ─────────────────────────────
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const compareRoutes = require('./routes/compare.routes');
const executeRoutes = require('./routes/execute.routes');
const historyRoutes = require('./routes/history.routes');
const auditRoutes = require('./routes/audit.routes');
const orgRoutes = require('./routes/organization.routes');

// ── Middleware Imports ─────────────────────────
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const app = express();

// ── Security Headers ──────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID'],
}));

// ── Rate Limiting ─────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Body Parsers ──────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── HTTP Request Logger ───────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health Check ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'DbNex API',
    vendor: 'Vayunex Solution',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/audit', auditRoutes);

// ── 404 & Error Handlers ─────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('✅ MySQL database connected via Prisma');

    app.listen(PORT, () => {
      logger.info(`🚀 DbNex API running on port ${PORT}`);
      logger.info(`   Environment : ${process.env.NODE_ENV}`);
      logger.info(`   Frontend URL: ${process.env.FRONTEND_URL}`);
      logger.info(`   Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

module.exports = app;
