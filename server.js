require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDb } = require('./backend/db');
const { authenticateToken } = require('./backend/middleware/auth');

const app = express();
const PORT = 3000;

// Initialize Database
try {
  initDb();
} catch (err) {
  console.error('[Fatal Error] Database initialization failed. Exiting.', err);
  process.exit(1);
}

// Ensure uploads folder exists in backend
const uploadsDir = path.join(__dirname, 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount Global JWT Authenticator
app.use(authenticateToken);

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Import Routers
const authRouter = require('./backend/routes/auth');
const reportsRouter = require('./backend/routes/reports');
const incidentsRouter = require('./backend/routes/incidents');
const demoRouter = require('./backend/routes/demo');

// Mount Routers
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/demo', demoRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

async function startServer() {
  // Vite Middleware for development / Static files in production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: path.join(__dirname, 'frontend'),
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('[Vite Integration Error]', err);
    }
  } else {
    const distPath = path.join(__dirname, 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

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

  // Start Server on 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CivicPulse AI Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[CivicPulse AI Server] Serving uploads statically at /uploads`);
  });
}

startServer();
