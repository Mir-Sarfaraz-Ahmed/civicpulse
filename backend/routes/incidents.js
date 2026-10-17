const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadToStorage } = require('../supabase');
const { syncIncident, syncStatusHistory } = require('../supabaseSync');

const router = express.Router();

// Configure in-memory upload storage (Zero local disk writes, direct to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'));
    }
  }
});

// Strict state transition machine definition
const VALID_TRANSITIONS = {
  'Reported': ['Under Review', 'Verified', 'Assigned', 'Rejected'],
  'Under Review': ['Verified', 'Reported', 'Rejected'],
  'AI Analysed': ['Verified', 'Under Review', 'Rejected'],
  'Verified': ['Assigned', 'Rejected'],
  'Assigned': ['Accepted', 'In Progress', 'Dispatched', 'Rejected'],
  'Accepted': ['In Progress', 'Resolution Submitted'],
  'Dispatched': ['In Progress', 'Resolution Submitted'],
  'In Progress': ['Resolution Submitted', 'Resolved'],
  'Resolution Submitted': ['Closed', 'Resolved', 'Resolution Rejected'],
  'Resolution Rejected': ['In Progress', 'Accepted', 'Rejected'],
  'Resolved': ['Closed'],
  'Closed': ['Reported'],
  'Rejected': ['Reported', 'Under Review']
};

function isValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed && allowed.includes(nextStatus);
}

// Helper to log status history changes
function logStatusChange(incidentId, status, changedBy, notes, actorName = null) {
  try {
    const historyId = uuidv4();
    const actorId = changedBy || 'admin-system-id';
    const now = new Date().toISOString();

    // Verify actor exists in DB to satisfy foreign key constraints
    const existing = query.get('SELECT id FROM users WHERE id = ?', [actorId]);
    if (!existing) {
      query.run(
        'INSERT OR IGNORE INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, NULL, ?, ?, ?)',
        [actorId, 'system@civilpulse.gov.in', 'admin', actorName || 'System Officer', now]
      );
    }

    query.run(
      'INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, incidentId, status, actorId, notes || '', now]
    );

    // Sync to Supabase status history
    syncStatusHistory({
      id: historyId,
      incident_id: incidentId,
      status,
      changed_by: actorId,
      notes: notes || '',
      created_at: now
    });

    // Automatically sync updated incident state to Supabase PostgreSQL
    try {
      const updatedIncident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
      if (updatedIncident) {
        syncIncident(updatedIncident);
      }
    } catch (e) {}
  } catch (err) {
    console.warn('[Status History Warning] Could not write audit log:', err.message);
  }
}

// ==========================================
// 1. STATS & INCIDENT LIST (Admin / Authenticated)
// ==========================================

// GET /api/incidents/stats
router.get('/stats', requireAuth, (req, res) => {
  try {
    const totalRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status NOT IN ('Closed', 'Rejected')");
    const criticalRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE severity = 'Critical' AND status NOT IN ('Closed', 'Rejected')");
    const highPriorityRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE severity = 'High' AND status NOT IN ('Closed', 'Rejected')");
    const resolvedRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status IN ('Resolved', 'Closed')");
    const rejectedRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status = 'Rejected'");
    const pendingApprovalRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status = 'Resolution Submitted'");
    const inProgressRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status IN ('Assigned', 'Accepted', 'In Progress', 'Dispatched')");
    const pendingVerificationRow = query.get("SELECT COUNT(*) as count FROM incidents WHERE status IN ('Reported', 'Under Review', 'AI Analysed')");

    res.json({
      totalActive: totalRow ? totalRow.count : 0,
      critical: criticalRow ? criticalRow.count : 0,
      highPriority: highPriorityRow ? highPriorityRow.count : 0,
      resolved: resolvedRow ? resolvedRow.count : 0,
      rejected: rejectedRow ? rejectedRow.count : 0,
      pendingApproval: pendingApprovalRow ? pendingApprovalRow.count : 0,
      inProgress: inProgressRow ? inProgressRow.count : 0,
      pendingVerification: pendingVerificationRow ? pendingVerificationRow.count : 0
    });
  } catch (err) {
    console.error('[Incidents API Error] Failed to get stats:', err);
    res.status(500).json({ error: 'Internal server error fetching statistics.' });
  }
});

// GET /api/incidents
router.get('/', requireAuth, (req, res) => {
  try {
    const statusFilter = req.query.status;
    let sql = `
      SELECT i.*, 
             (SELECT COUNT(*) FROM reports WHERE incident_id = i.id) as report_count
      FROM incidents i
    `;
    const params = [];

    if (statusFilter) {
      sql += ` WHERE i.status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY i.priority_score DESC, i.created_at DESC`;

    const incidents = query.all(sql, params);
    res.json(incidents);
  } catch (err) {
    console.error('[Incidents API Error] Failed to get incidents:', err);
    res.status(500).json({ error: 'Internal server error fetching incidents.' });
  }
});

// GET /api/incidents/crew/tasks (Dispatch Crew Tasks)
router.get('/crew/tasks', requireAuth, (req, res) => {
  try {
    const crewName = req.user.name;
    const crewEmail = req.user.email;
    const crewId = req.user.id;

    // Fetch tasks that are assigned, accepted, in progress, resolution submitted, or rejected
    const tasks = query.all(`
      SELECT i.*, 
             (SELECT COUNT(*) FROM reports WHERE incident_id = i.id) as report_count,
             (SELECT image_url FROM reports WHERE incident_id = i.id LIMIT 1) as first_report_image,
             (SELECT description FROM reports WHERE incident_id = i.id LIMIT 1) as first_report_desc
      FROM incidents i
      WHERE i.status IN ('Assigned', 'Accepted', 'In Progress', 'Resolution Submitted', 'Resolution Rejected')
      ORDER BY i.priority_score DESC, i.updated_at DESC
    `);

    res.json(tasks);
  } catch (err) {
    console.error('[Crew Tasks Error]', err);
    res.status(500).json({ error: 'Failed to fetch crew assignments.' });
  }
});

// GET /api/incidents/:id (Specific Incident Details)
router.get('/:id', requireAuth, (req, res) => {
  const incidentId = req.params.id;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    // Fetch reports grouped under this incident
    const reports = query.all(`
      SELECT r.*, COALESCE(u.name, 'Citizen') as citizen_name, COALESCE(u.email, 'citizen@civilpulse.gov.in') as citizen_email
      FROM reports r
      LEFT JOIN users u ON r.citizen_id = u.id
      WHERE r.incident_id = ?
      ORDER BY r.created_at ASC
    `, [incidentId]);

    // Fetch status history log
    const history = query.all(`
      SELECT h.*, COALESCE(u.name, 'System Officer') as actor_name, COALESCE(u.email, 'admin@civilpulse.gov.in') as actor_email
      FROM incident_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.incident_id = ?
      ORDER BY h.created_at DESC
    `, [incidentId]);

    res.json({
      incident,
      reports,
      history
    });
  } catch (err) {
    console.error('[Incidents API Error] Failed to get incident details:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// 2. ADMIN LIFECYCLE ACTIONS
// ==========================================

// PATCH /api/incidents/:id/verify (Admin: Verify Incident)
router.patch('/:id/verify', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Verified';
    if (!isValidTransition(incident.status, nextStatus)) {
      return res.status(400).json({ error: `Invalid status transition from ${incident.status} to ${nextStatus}` });
    }

    query.run(
      'UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?',
      [nextStatus, new Date().toISOString(), incidentId]
    );

    logStatusChange(incidentId, nextStatus, req.user?.id, notes || 'Incident verified by municipal authority.', req.user?.name);

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('[Admin API Error] Verification failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/reject (Admin: Reject Incident as False Report / Invalid / Duplicate)
router.patch('/:id/reject', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { rejectionReason, notes } = req.body;

  const reason = (rejectionReason || notes || 'False Report / Invalid Issue').trim();

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Rejected';
    const now = new Date().toISOString();

    query.run(
      `UPDATE incidents 
       SET status = ?, rejection_reason = ?, rejected_at = ?, rejected_by = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, reason, now, req.user?.id || 'admin', now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      `Incident Rejected by Municipal Authority. Reason: ${reason}`, 
      req.user?.name
    );

    res.json({ success: true, status: nextStatus, rejection_reason: reason });
  } catch (err) {
    console.error('[Admin API Error] Incident rejection failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/assign (Admin: Assign Dispatch Crew)
router.patch('/:id/assign', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { workerName, crewId, dispatchNotes, notes } = req.body;

  if (!workerName) {
    return res.status(400).json({ error: 'Field worker or crew name is required.' });
  }

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Assigned';
    if (!isValidTransition(incident.status, nextStatus) && incident.status !== 'Reported' && incident.status !== 'Under Review') {
      return res.status(400).json({ error: `Invalid status transition from ${incident.status} to ${nextStatus}` });
    }

    const now = new Date().toISOString();
    query.run(
      `UPDATE incidents 
       SET status = ?, assigned_worker = ?, assigned_crew_id = ?, assigned_at = ?, dispatch_notes = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, workerName, crewId || null, now, dispatchNotes || '', now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      notes || `Assigned to dispatch crew: ${workerName}. Notes: ${dispatchNotes || 'Standard priority dispatch.'}`,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus, assigned_worker: workerName });
  } catch (err) {
    console.error('[Admin API Error] Assignment failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/approve (Admin: Approve Resolution & Close)
router.patch('/:id/approve', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    if (incident.status !== 'Resolution Submitted' && incident.status !== 'Resolved' && incident.status !== 'In Progress') {
      return res.status(400).json({ error: `Cannot approve incident with status '${incident.status}'. Must be 'Resolution Submitted'.` });
    }

    const nextStatus = 'Closed';
    const now = new Date().toISOString();

    query.run(
      `UPDATE incidents 
       SET status = ?, approved_by = ?, approved_at = ?, closed_at = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, req.user?.id || 'admin', now, now, now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      notes || `Resolution verified and approved by admin (${req.user?.name || 'Administrator'}). Incident formally closed.`,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus, approved_at: now });
  } catch (err) {
    console.error('[Admin API Error] Approval failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/reject-resolution (Admin: Reject Resolution with Mandatory Reason)
router.patch('/:id/reject-resolution', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { rejectionReason, notes } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ error: 'A specific rejection reason is required when rejecting a resolution.' });
  }

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Resolution Rejected';
    const now = new Date().toISOString();

    query.run(
      `UPDATE incidents 
       SET status = ?, rejection_reason = ?, rejected_at = ?, rejected_by = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, rejectionReason.trim(), now, req.user?.id || 'admin', now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      `Resolution Rejected by Admin: ${rejectionReason.trim()}`,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus, rejection_reason: rejectionReason.trim() });
  } catch (err) {
    console.error('[Admin API Error] Rejection failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/close (Admin: Direct Close)
router.patch('/:id/close', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Closed';
    const now = new Date().toISOString();

    query.run(
      'UPDATE incidents SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?',
      [nextStatus, now, now, incidentId]
    );

    logStatusChange(incidentId, nextStatus, req.user?.id, notes || 'Incident closed and archived by administrator.', req.user?.name);

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('[Admin API Error] Closure failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// 3. DISPATCH CREW LIFECYCLE ACTIONS
// ==========================================

// PATCH /api/incidents/:id/crew-accept (Crew: Accept Task)
router.patch('/:id/crew-accept', requireAuth, (req, res) => {
  const incidentId = req.params.id;
  const { notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Accepted';
    if (!isValidTransition(incident.status, nextStatus) && incident.status !== 'Assigned') {
      return res.status(400).json({ error: `Cannot accept incident in state ${incident.status}` });
    }

    const now = new Date().toISOString();
    query.run(
      'UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?',
      [nextStatus, now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      notes || `Job accepted by dispatch crew: ${req.user?.name || incident.assigned_worker || 'Field Unit'}.`,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('[Crew API Error] Accept failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/crew-start (Crew: Start Work / Rework)
router.patch('/:id/crew-start', requireAuth, (req, res) => {
  const incidentId = req.params.id;
  const { notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'In Progress';
    const now = new Date().toISOString();

    query.run(
      'UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?',
      [nextStatus, now, incidentId]
    );

    const logNote = incident.status === 'Resolution Rejected'
      ? `Crew resumed rework after rejection feedback. ${notes || ''}`
      : `Crew arrived on site and commenced repair work. ${notes || ''}`;

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      logNote,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('[Crew API Error] Start work failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/crew-submit-resolution (Crew: Submit Resolution with Evidence Photo)
router.patch('/:id/crew-submit-resolution', requireAuth, upload.single('evidence'), async (req, res) => {
  const incidentId = req.params.id;
  const { resolutionNotes, notes, evidenceUrl: providedUrl } = req.body;

  let finalEvidenceUrl = providedUrl;
  if (req.file && !finalEvidenceUrl) {
    try {
      const storageUrl = await uploadToStorage(req.file.buffer, req.file.originalname, req.file.mimetype, 'resolutions', req.user?.id || 'crew');
      if (storageUrl) {
        finalEvidenceUrl = storageUrl;
        console.log(`[Supabase Storage] Resolution evidence uploaded to user folder: ${finalEvidenceUrl}`);
      }
    } catch (storageErr) {
      console.warn('[Supabase Storage Warning] Resolution evidence upload error:', storageErr.message);
    }
  }

  if (!finalEvidenceUrl) {
    return res.status(400).json({ error: 'Resolution photo evidence is required to submit resolution.' });
  }

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Resolution Submitted';
    const now = new Date().toISOString();

    query.run(
      `UPDATE incidents 
       SET status = ?, resolution_evidence_url = ?, resolution_notes = ?, resolution_submitted_at = ?, resolved_at = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, finalEvidenceUrl, resolutionNotes || notes || 'Field repair completed.', now, now, now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      `Resolution submitted by crew (${req.user?.name || 'Field Unit'}). Evidence photo uploaded. Awaiting Admin verification. Notes: ${resolutionNotes || notes || 'Work completed'}`,
      req.user?.name
    );

    // Sync updated incident to Supabase
    syncIncident({
      ...incident,
      status: nextStatus,
      resolution_evidence_url: finalEvidenceUrl,
      resolution_notes: resolutionNotes || notes || 'Field repair completed.',
      resolution_submitted_at: now,
      resolved_at: now,
      updated_at: now
    });

    res.json({ 
      success: true, 
      status: nextStatus, 
      evidenceUrl: finalEvidenceUrl,
      resolution_notes: resolutionNotes || notes
    });
  } catch (err) {
    console.error('[Crew API Error] Resolution submission failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/dispatch (Legacy Dispatch endpoint support)
router.patch('/:id/dispatch', requireRole('admin'), (req, res) => {
  const incidentId = req.params.id;
  const { dispatchNotes, notes } = req.body;

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Dispatched';
    query.run(
      'UPDATE incidents SET status = ?, dispatch_notes = ?, updated_at = ? WHERE id = ?',
      [nextStatus, dispatchNotes || '', new Date().toISOString(), incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      notes || `Dispatch initialized: ${dispatchNotes || 'No notes'}`,
      req.user?.name
    );

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('[Admin API Error] Dispatch failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/incidents/:id/resolve (Legacy / Admin Direct Resolve)
router.patch('/:id/resolve', requireAuth, upload.single('evidence'), async (req, res) => {
  const incidentId = req.params.id;
  const { notes, resolutionNotes, evidenceUrl: providedUrl } = req.body;

  let evidenceUrl = providedUrl;
  if (req.file && !evidenceUrl) {
    try {
      const storageUrl = await uploadToStorage(req.file.buffer, req.file.originalname, req.file.mimetype, 'resolutions', req.user?.id || 'admin');
      if (storageUrl) evidenceUrl = storageUrl;
    } catch (e) {}
  }

  if (!evidenceUrl) {
    return res.status(400).json({ error: 'Resolution evidence image file is required.' });
  }

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    const nextStatus = 'Resolution Submitted';
    const now = new Date().toISOString();

    query.run(
      `UPDATE incidents 
       SET status = ?, resolution_evidence_url = ?, resolution_notes = ?, resolution_submitted_at = ?, resolved_at = ?, updated_at = ? 
       WHERE id = ?`,
      [nextStatus, evidenceUrl, resolutionNotes || notes || 'Resolved with photo evidence.', now, now, now, incidentId]
    );

    logStatusChange(
      incidentId, 
      nextStatus, 
      req.user?.id, 
      notes || 'Incident resolution submitted with photo evidence.',
      req.user?.name
    );

    res.json({ success: true, status: nextStatus, evidenceUrl });
  } catch (err) {
    console.error('[Admin API Error] Resolution failed:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
