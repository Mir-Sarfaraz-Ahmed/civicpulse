const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'civicpulse_hackathon_jwt_secret_2026_key';

function decodeFirebaseToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Firebase ID tokens contain: sub (user_id), email, name, firebase metadata
    const userId = payload.user_id || payload.sub;
    if (userId && payload.email) {
      const normalizedEmail = payload.email.toLowerCase().trim();
      
      let dbRole = null;
      let dbName = null;
      try {
        const existing = query.get('SELECT role, name FROM users WHERE email = ? OR id = ?', [normalizedEmail, userId]);
        if (existing) {
          dbRole = existing.role;
          dbName = existing.name;
        }
      } catch (e) {}

      const role = dbRole || payload.role || (payload.admin === true ? 'admin' : 'civilian');

      return {
        id: userId,
        email: payload.email,
        role: role,
        name: dbName || payload.name || payload.email.split('@')[0],
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

const { query } = require('../db');

// Upsert user into local SQLite database so foreign keys (reports, history) always resolve
function ensureUserInDb(user) {
  if (!user || !user.id) return;
  try {
    const existing = query.get('SELECT id FROM users WHERE id = ?', [user.id]);
    if (!existing) {
      // Check if same email exists with different ID (e.g. from previous demo seeder)
      const emailMatch = query.get('SELECT id FROM users WHERE email = ?', [user.email]);
      if (emailMatch) {
        query.run(
          'UPDATE users SET id = ?, name = ?, role = ? WHERE email = ?',
          [user.id, user.name || user.email, user.role || 'civilian', user.email]
        );
      } else {
        query.run(
          'INSERT INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, NULL, ?, ?, ?)',
          [user.id, user.email, user.role || 'civilian', user.name || user.email, new Date().toISOString()]
        );
      }
    }
  } catch (err) {
    console.warn('[Auth Middleware] User DB sync warning:', err.message);
  }
}

const { getUserFromToken } = require('../supabase');

// Middleware to authenticate JWT (supports Supabase Auth, local JWTs, and Firebase tokens)
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    req.user = null;
    return next();
  }

  // Try 1: Supabase Auth Token Verification
  try {
    const supabaseUser = await getUserFromToken(token);
    if (supabaseUser) {
      req.user = supabaseUser;
      ensureUserInDb(supabaseUser);
      return next();
    }
  } catch (err) {
    // Proceed to next fallback
  }

  // Try 2: Verify with local JWT_SECRET (backend-issued tokens)
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) {
      req.user = user;
      ensureUserInDb(user);
      return next();
    }

    // Try 3: Decode as legacy Firebase JWT
    const firebaseUser = decodeFirebaseToken(token);
    if (firebaseUser) {
      req.user = firebaseUser;
      ensureUserInDb(firebaseUser);
      return next();
    }

    console.warn('[Auth Middleware] Invalid token received.');
    req.user = null;
    return next();
  });
}

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
  ensureUserInDb(req.user);
  next();
}

// Middleware to require a specific role
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    if (req.user.role !== role) {
      console.warn(`[Security Alert] User ${req.user.email} attempted to access an admin endpoint.`);
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireRole,
  JWT_SECRET
};

