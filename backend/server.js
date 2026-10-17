require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database
try {
  initDb();
} catch (err) {
  console.error('[Fatal Error] Database initialization failed. Exiting.', err);
  process.exit(1);
}

// Storage is fully cloud-hosted via Supabase Storage bucket ('civicpusleai')

// Global Middlewares
app.use(cors()); // Allow cross-origin requests from React dev client
app.use(express.json({ limit: '15mb' })); // Support JSON parsing
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Mount Global JWT Authenticator
app.use(authenticateToken);

// Optional static fallback for legacy local uploads if folder exists
const legacyUploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(legacyUploadsDir)) {
  app.use('/uploads', express.static(legacyUploadsDir));
}

// Import Routers
const authRouter = require('./routes/auth');
const reportsRouter = require('./routes/reports');
const incidentsRouter = require('./routes/incidents');
const demoRouter = require('./routes/demo');

// Mount Routers
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/demo', demoRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error Handler] Captured error:`, err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  res.status(500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[CivicPulse AI Server] Running on http://localhost:${PORT}`);
  console.log(`[CivicPulse AI Server] Serving upload photos statically at /uploads`);
});
