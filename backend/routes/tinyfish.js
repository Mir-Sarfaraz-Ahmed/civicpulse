const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { syncIncident, syncStatusHistory } = require('../supabaseSync');
const { v4: uuidv4 } = require('uuid');
const {
  MUNICIPAL_PORTALS,
  getRecommendedPortal,
  getTinyFishStatus,
  lodgeIncidentWithTinyFish,
  searchCivicIntelligence
} = require('../services/tinyfishService');

const router = express.Router();

// Helper to log status history changes
function logAuditHistory(incidentId, status, changedBy, notes, actorName = null) {
  try {
    const historyId = uuidv4();
    const actorId = changedBy || 'admin';
    const now = new Date().toISOString();

    query.run(
      'INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, incidentId, status, actorId, notes || '', now]
    );

    syncStatusHistory({
      id: historyId,
      incident_id: incidentId,
      status,
      changed_by: actorId,
      notes: notes || '',
      created_at: now
    });
  } catch (err) {
    console.warn('[TinyFish Audit Warning]', err.message);
  }
}

// 1. GET /api/tinyfish/config
// Returns portal presets, categories, and configuration status
router.get('/config', (req, res) => {
  res.json({
    configured: Boolean(process.env.TINYFISH_API_KEY && process.env.TINYFISH_API_KEY.trim()),
    portals: MUNICIPAL_PORTALS
  });
});

// 2. GET /api/tinyfish/status
// Verifies live API key, SDK connectivity, and wallet credits
router.get('/status', async (req, res) => {
  try {
    const status = await getTinyFishStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/tinyfish/escalate
// Escalate a verified or high-priority incident directly to external municipal grievance portals
router.post('/escalate', requireAuth, async (req, res) => {
  const { incidentId, portalKey, customUrl, customGoal, simulate } = req.body;

  if (!incidentId) {
    return res.status(400).json({ error: 'incidentId is required to escalate.' });
  }

  try {
    const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) {
      return res.status(404).json({ error: `Incident #${incidentId} not found.` });
    }

    // Retrieve clustered citizen reports for rich context
    const reports = query.all('SELECT * FROM reports WHERE incident_id = ? ORDER BY created_at ASC', [incidentId]);

    // Dispatch via TinyFish Agent
    const dispatchResult = await lodgeIncidentWithTinyFish({
      incident,
      reports,
      portalKey,
      customUrl,
      customGoal,
      simulate: Boolean(simulate)
    });

    const now = new Date().toISOString();

    // Update incident in local SQLite cache
    query.run(
      `UPDATE incidents 
       SET external_lodging_status = ?,
           external_portal_name = ?,
           external_reference_id = ?,
           external_lodged_at = ?,
           external_lodging_details = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        dispatchResult.status,
        dispatchResult.portalName,
        dispatchResult.referenceId,
        now,
        JSON.stringify(dispatchResult),
        now,
        incidentId
      ]
    );

    const auditNotes = `🏛️ Lodged with ${dispatchResult.portalName} via TinyFish Autonomous Agent. Ticket Ref: ${dispatchResult.referenceId} (${dispatchResult.simulated ? 'Simulation / Test Mode' : 'Live Autonomous Session'}).`;
    logAuditHistory(incidentId, incident.status, req.user?.id, auditNotes, req.user?.name);

    // Fetch updated incident
    const updatedIncident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);

    // Sync to Supabase PostgreSQL
    if (updatedIncident) {
      syncIncident(updatedIncident);
    }

    res.json({
      success: true,
      result: dispatchResult,
      incident: updatedIncident,
      message: `Incident escalated to ${dispatchResult.portalName} (Ref: ${dispatchResult.referenceId})`
    });

  } catch (err) {
    console.error('[TinyFish Escalation Error]', err);
    res.status(500).json({ error: err.message || 'Failed to escalate incident via TinyFish Agent.' });
  }
});

// 4. POST /api/tinyfish/test-agent
// Run an ad-hoc browser agent task
router.post('/test-agent', requireAuth, async (req, res) => {
  const { url, goal } = req.body;
  if (!url || !goal) {
    return res.status(400).json({ error: 'url and goal are required.' });
  }

  try {
    const { getTinyFishClient } = require('../services/tinyfishService');
    const client = await getTinyFishClient();
    
    if (!client) {
      return res.json({
        simulated: true,
        message: 'TINYFISH_API_KEY not configured. Simulated test run executed successfully.',
        run_id: `run_sim_${Date.now()}`,
        result: {
          status: 'success',
          summary: `Simulated navigation to ${url} with goal: "${goal}". Form parameters verified.`
        }
      });
    }

    const run = await client.agent.run({ url, goal });
    res.json({
      simulated: false,
      run_id: run.run_id,
      result: run.result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /api/tinyfish/search
// Live civic search intelligence
router.get('/search', async (req, res) => {
  const queryText = req.query.q;
  if (!queryText) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  try {
    const searchResults = await searchCivicIntelligence(queryText);
    res.json(searchResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
