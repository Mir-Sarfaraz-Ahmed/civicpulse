const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('../backend/db');
const { authenticateToken } = require('../backend/middleware/auth');

const app = express();

// Initialize database
try {
  initDb();
} catch (err) {
  console.error('[Vercel Serverless Error] DB init failed:', err);
}

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, '..', 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(authenticateToken);
app.use('/uploads', express.static(uploadsDir));

// Import routers
const authRouter = require('../backend/routes/auth');
const reportsRouter = require('../backend/routes/reports');
const incidentsRouter = require('../backend/routes/incidents');
const demoRouter = require('../backend/routes/demo');

app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/demo', demoRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, time: new Date() });
});

module.exports = app;
