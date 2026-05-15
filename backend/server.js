const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
require('dotenv').config();

const authRoutes       = require('./routes/auth');
const requestRoutes    = require('./routes/requests');
const offerRoutes      = require('./routes/offers');
const messageRoutes    = require('./routes/messages');
const userRoutes       = require('./routes/users');
const adminRoutes      = require('./routes/admin');
const categoryRoutes   = require('./routes/categories');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security & Middleware ────────────────────────────────────
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/requests',   requestRoutes);
app.use('/api/offers',     offerRoutes);
app.use('/api/messages',   messageRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/categories', categoryRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Bayanihan Connect API is running', timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Max size is 5MB.' });
  }
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Server Start (Local Development Only) ───────────────────
// In Vercel serverless, this will be skipped and the app will be exported
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   Bayanihan Connect API                ║`);
    console.log(`║   Running on http://localhost:${PORT}     ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
  });
}

module.exports = app;
