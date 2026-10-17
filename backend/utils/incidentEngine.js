const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { syncIncident, syncStatusHistory } = require('../supabaseSync');

// Haversine formula to compute distance in meters between two coordinate sets
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate the deterministic Civic Priority Score (0-100)
function calculatePriorityScore(category, severity, description, reportCount) {
  let severityWeight = 10; // Low
  if (severity === 'Medium') severityWeight = 20;
  else if (severity === 'High') severityWeight = 35;
  else if (severity === 'Critical') severityWeight = 50;

  let categoryWeight = 5; // Other
  if (category === 'Garbage / Dumping') categoryWeight = 10;
  else if (category === 'Water Leakage') categoryWeight = 15;
  else if (category === 'Traffic') categoryWeight = 15;
  else if (category === 'Safety Hazards') categoryWeight = 20;
  else if (category === 'Road Infrastructure') categoryWeight = 25;
  else if (category === 'Damaged Infrastructure') categoryWeight = 25;

  let baseScore = severityWeight + categoryWeight;

  // Context Modifier: proximity to sensitive places detected via text
  let locationModifier = 0;
  const text = (description || '').toLowerCase();
  if (
    text.includes('school') ||
    text.includes('hospital') ||
    text.includes('metro') ||
    text.includes('highway') ||
    text.includes('main road') ||
    text.includes('junction') ||
    text.includes('market')
  ) {
    locationModifier = 10;
  }

  // Frequency Modifier: +5 per additional report (capped at 15 points)
  const frequencyModifier = Math.min(15, (reportCount - 1) * 5);

  const finalScore = Math.min(100, baseScore + locationModifier + frequencyModifier);

  console.log(`[Priority Engine] Score calculated: ${finalScore}/100 (Base: ${baseScore}, LocMod: ${locationModifier}, FreqMod: ${frequencyModifier})`);
  return finalScore;
}

// Detect duplicate incidents and group reports accordingly
function processReportGrouping(reportId, reportData) {
  const { category, severity, latitude, longitude, description, address, citizenId } = reportData;

  // Retrieve active incidents (not closed, not resolved) in the same category
  const activeIncidents = query.all(
    "SELECT * FROM incidents WHERE status NOT IN ('Resolved', 'Closed') AND category = ?",
    [category]
  );

  let matchedIncident = null;

  for (const incident of activeIncidents) {
    const dist = haversineDistance(latitude, longitude, incident.latitude, incident.longitude);
    // Threshold for duplicate grouping: 100 meters
    if (dist <= 100) {
      matchedIncident = incident;
      console.log(`[Duplicate Detector] Match found! Report ${reportId} matches Incident ${incident.id} (distance: ${dist.toFixed(1)}m)`);
      break;
    }
  }

  if (matchedIncident) {
    // 1. Group under existing incident
    // Count existing reports linked to this incident
    const reportCountRow = query.get('SELECT COUNT(*) as count FROM reports WHERE incident_id = ?', [matchedIncident.id]);
    const reportCount = (reportCountRow ? reportCountRow.count : 0) + 1; // including the new one

    // Escalate severity if new report is more severe
    const severityLevels = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    let finalSeverity = matchedIncident.severity;
    if (severityLevels[severity] > severityLevels[matchedIncident.severity]) {
      finalSeverity = severity;
      console.log(`[Duplicate Detector] Esculating Incident ${matchedIncident.id} severity to ${severity}`);
    }

    // Recalculate priority score
    const newPriorityScore = calculatePriorityScore(category, finalSeverity, description, reportCount);
    const updatedAt = new Date().toISOString();

    // Update incident properties
    query.run(
      'UPDATE incidents SET severity = ?, priority_score = ?, updated_at = ? WHERE id = ?',
      [finalSeverity, newPriorityScore, updatedAt, matchedIncident.id]
    );

    // Link report
    query.run('UPDATE reports SET incident_id = ? WHERE id = ?', [matchedIncident.id, reportId]);

    // Record in history
    const historyId = uuidv4();
    const historyNotes = `Report linked. Severity re-evaluated, priority score updated to ${newPriorityScore}.`;
    query.run(
      'INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, matchedIncident.id, matchedIncident.status, citizenId, historyNotes, updatedAt]
    );

    // Sync to Supabase PostgreSQL
    syncIncident({
      ...matchedIncident,
      severity: finalSeverity,
      priority_score: newPriorityScore,
      updated_at: updatedAt
    });
    syncStatusHistory({
      id: historyId,
      incident_id: matchedIncident.id,
      status: matchedIncident.status,
      changed_by: citizenId,
      notes: historyNotes,
      created_at: updatedAt
    });

    return matchedIncident.id;
  } else {
    // 2. Create a new incident
    const incidentId = uuidv4();
    const priorityScore = calculatePriorityScore(category, severity, description, 1);
    const now = new Date().toISOString();

    const newIncident = {
      id: incidentId,
      category,
      severity,
      priority_score: priorityScore,
      status: 'Reported',
      latitude,
      longitude,
      address: address || 'Delhi, India',
      created_at: now,
      updated_at: now
    };

    query.run(
      `INSERT INTO incidents (id, category, severity, priority_score, status, latitude, longitude, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [incidentId, category, severity, priorityScore, 'Reported', latitude, longitude, address || 'Delhi, India', now, now]
    );

    // Link report
    query.run('UPDATE reports SET incident_id = ? WHERE id = ?', [incidentId, reportId]);

    // Record initial status history
    const historyId = uuidv4();
    const historyNotes = 'Initial report registered. Incident created.';
    query.run(
      'INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, incidentId, 'Reported', citizenId, historyNotes, now]
    );

    // Sync to Supabase PostgreSQL
    syncIncident(newIncident);
    syncStatusHistory({
      id: historyId,
      incident_id: incidentId,
      status: 'Reported',
      changed_by: citizenId,
      notes: historyNotes,
      created_at: now
    });

    console.log(`[Duplicate Detector] Created new incident ${incidentId} for report ${reportId}`);
    return incidentId;
  }
}

module.exports = {
  calculatePriorityScore,
  processReportGrouping
};
