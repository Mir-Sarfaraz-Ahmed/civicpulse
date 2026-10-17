const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Ensure the database file is placed in a writable folder (uses /tmp on Vercel)
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');
const db = new DatabaseSync(dbPath);

console.log(`[Database] Connected to SQLite database at ${dbPath}`);

// Initialize schemas
function initDb() {
  console.log('[Database] Running migrations...');

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL, -- 'civilian' | 'admin'
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'Reported' | 'Under Review' | 'Verified' | 'Assigned' | 'Accepted' | 'In Progress' | 'Resolution Submitted' | 'Resolution Rejected' | 'Resolved' | 'Closed'
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      assigned_worker TEXT,
      assigned_crew_id TEXT,
      assigned_at TIMESTAMP,
      dispatch_notes TEXT,
      resolution_evidence_url TEXT,
      resolution_notes TEXT,
      resolution_submitted_at TIMESTAMP,
      rejection_reason TEXT,
      rejected_at TIMESTAMP,
      rejected_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      resolved_at TIMESTAMP,
      closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      citizen_id TEXT NOT NULL,
      incident_id TEXT,
      image_url TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      ai_problem TEXT,
      ai_category TEXT,
      ai_severity TEXT,
      ai_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_status_history (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Ensure new columns exist for existing database files
  const newCols = [
    'assigned_crew_id TEXT',
    'assigned_at TIMESTAMP',
    'resolution_notes TEXT',
    'resolution_submitted_at TIMESTAMP',
    'rejection_reason TEXT',
    'rejected_at TIMESTAMP',
    'rejected_by TEXT',
    'approved_by TEXT',
    'approved_at TIMESTAMP'
  ];
  for (const colDef of newCols) {
    try {
      db.exec(`ALTER TABLE incidents ADD COLUMN ${colDef};`);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  // Indexes for faster lookups
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_incidents_coords ON incidents(latitude, longitude);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reports_incident ON reports(incident_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_history_incident ON incident_status_history(incident_id);');

  // Ensure ONLY the 3 requested default demo users exist in the database
  try {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');

    const defaultUsers = [
      {
        email: 'admin@gmail.com',
        password: '31102006',
        role: 'admin',
        name: 'City Municipal Admin'
      },
      {
        email: 'crew@gmail.com',
        password: '31102006',
        role: 'crew',
        name: 'Rapid Response Dispatch Crew'
      },
      {
        email: 'citizen@gmail.com',
        password: '31102006',
        role: 'civilian',
        name: 'Citizen Reporter'
      }
    ];

    // Delete any old preset users
    db.prepare(`
      DELETE FROM users 
      WHERE email IN (
        'admin@directgmail.com', 'crew@directgmail.com', 'citizen@directgmail.com',
        'admin@admindirectgmail.com', 'admin@admingmail.com', 'crew@crewgmail.com', 'citizen@citizengmail.com'
      )
    `).run();

    for (const u of defaultUsers) {
      const existing = db.prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(u.email);
      const hash = bcrypt.hashSync(u.password, 10);
      if (!existing) {
        const id = uuidv4();
        db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)').run(
          id, u.email, hash, u.role, u.name
        );
        console.log(`[Database Init] Created preset account: ${u.email} (${u.role})`);
      } else {
        db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ? WHERE email = ?').run(
          hash, u.role, u.name, u.email
        );
        console.log(`[Database Init] Synchronized preset account: ${u.email}`);
      }

      // Sync preset profiles to Supabase if available
      try {
        const { supabase } = require('./supabase');
        supabase.from('profiles').upsert([
          { email: u.email, role: u.role, name: u.name }
        ], { onConflict: 'email' }).then(() => {}).catch(() => {});
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[Database Init] Warning ensuring default users:', err.message);
  }

  console.log('[Database] Migrations completed successfully.');
}

// Wrapper methods for query execution
const query = {
  all(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error(`[Database Error] query.all failed: ${sql}`, error);
      throw error;
    }
  },

  get(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error(`[Database Error] query.get failed: ${sql}`, error);
      throw error;
    }
  },

  run(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      console.error(`[Database Error] query.run failed: ${sql}`, error);
      throw error;
    }
  },

  exec(sql) {
    try {
      return db.exec(sql);
    } catch (error) {
      console.error(`[Database Error] query.exec failed`, error);
      throw error;
    }
  }
};

module.exports = {
  initDb,
  query,
  dbPath
};
