const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { syncIncident, syncReport, syncStatusHistory, clearSupabaseTables } = require('../supabaseSync');

const router = express.Router();

// 1x1 pixel base64 PNG data for clean local placeholder images
const base64Images = {
  pothole: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+FbfQAI2wMXN86ZkwAAAABJRU5ErkJggg==', // grey
  garbage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaGD4DwACbQE9f0J8HAAAAABJRU5ErkJggg==', // green
  light: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',   // yellow
  water: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADEgGP7Lw2CwAAAABJRU5ErkJggg==',   // blue
  wire: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AABwAEhQGAhKmMIQAAAABJRU5ErkJggg==',    // orange
  resolved: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkiPj/DwADFAEP7Lw2CwAAAABJRU5ErkJggg=='  // bright green
};

function writeDemoImage(name, colorKey) {
  const data = base64Images[colorKey] || base64Images.pothole;
  return `data:image/png;base64,${data}`;
}

// Seed Route (Public, to initialize hackathon review easily)
// Endpoint: POST /api/demo/seed
router.post('/seed', (req, res) => {
  try {
    console.log('[Demo Seed] Starting database seeding...');

    // 1. Temporarily disable foreign key constraints to wipe cleanly
    query.exec('PRAGMA foreign_keys = OFF;');
    query.exec('DELETE FROM incident_status_history;');
    query.exec('DELETE FROM reports;');
    query.exec('DELETE FROM incidents;');
    query.exec('DELETE FROM users;');
    query.exec('PRAGMA foreign_keys = ON;');

    // 2. Write demo images
    const imgPothole = writeDemoImage('demo_pothole', 'pothole');
    const imgGarbage = writeDemoImage('demo_garbage', 'garbage');
    const imgLight = writeDemoImage('demo_light', 'light');
    const imgWater = writeDemoImage('demo_water', 'water');
    const imgWire = writeDemoImage('demo_wire', 'wire');
    const imgResolved = writeDemoImage('demo_resolved', 'resolved');

    // 3. Create Seed Users (Only the 3 requested accounts)
    const citizenId = uuidv4();
    const adminId = uuidv4();
    const crewId = uuidv4();

    const hashCivilian = bcrypt.hashSync('31102006', 10);
    const hashAdmin = bcrypt.hashSync('31102006', 10);
    const hashCrew = bcrypt.hashSync('31102006', 10);

    query.run(
      'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
      [citizenId, 'citizen@gmail.com', hashCivilian, 'civilian', 'Citizen Reporter']
    );
    query.run(
      'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
      [adminId, 'admin@gmail.com', hashAdmin, 'admin', 'City Municipal Admin']
    );
    query.run(
      'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
      [crewId, 'crew@gmail.com', hashCrew, 'crew', 'Rapid Response Dispatch Crew']
    );

    // Helper to insert incident, report, and initial status history
    function seedIncidentAndReports({
      incidentId = uuidv4(),
      category,
      severity,
      priorityScore,
      status,
      lat,
      lng,
      address,
      assignedWorker = null,
      assignedCrewId = null,
      dispatchNotes = null,
      resolvedEvidence = null,
      resolutionNotes = null,
      rejectionReason = null,
      approvedBy = null,
      reports = []
    }) {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();
      const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
      const oneHourAgo = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();

      // Create Incident
      query.run(
        `INSERT INTO incidents (
          id, category, severity, priority_score, status, latitude, longitude, address,
          assigned_worker, assigned_crew_id, assigned_at, dispatch_notes,
          resolution_evidence_url, resolution_notes, resolution_submitted_at,
          rejection_reason, rejected_at, rejected_by,
          approved_by, approved_at, resolved_at, closed_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          incidentId,
          category,
          severity,
          priorityScore,
          status,
          lat,
          lng,
          address,
          assignedWorker,
          assignedCrewId,
          assignedWorker ? oneDayAgo : null,
          dispatchNotes,
          resolvedEvidence,
          resolutionNotes,
          status === 'Resolution Submitted' || status === 'Resolution Rejected' || status === 'Closed' || status === 'Resolved' ? threeHoursAgo : null,
          rejectionReason,
          rejectionReason ? oneHourAgo : null,
          rejectionReason ? adminId : null,
          approvedBy,
          status === 'Closed' ? oneHourAgo : null,
          status === 'Resolved' || status === 'Closed' ? threeHoursAgo : null,
          status === 'Closed' ? oneHourAgo : null,
          twoDaysAgo,
          new Date().toISOString()
        ]
      );

      // Create initial status history log
      const hist1 = uuidv4();
      query.run(
        `INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at)
         VALUES (?, ?, 'Reported', ?, 'Citizen submitted report. AI vision categorized incident.', ?)`,
        [hist1, incidentId, citizenId, twoDaysAgo]
      );

      if (status !== 'Reported') {
        const hist2 = uuidv4();
        query.run(
          `INSERT INTO incident_status_history (id, incident_id, status, changed_by, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            hist2, 
            incidentId, 
            status, 
            status === 'Closed' ? adminId : (assignedWorker ? crewId : adminId),
            rejectionReason ? `Admin Feedback: ${rejectionReason}` : `Workflow progressed to ${status}.`, 
            oneDayAgo
          ]
        );
      }

      // Create reports
      reports.forEach((rep) => {
        const reportId = uuidv4();
        query.run(
          `INSERT INTO reports (id, citizen_id, incident_id, image_url, description, latitude, longitude, address, ai_problem, ai_category, ai_severity, ai_summary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId,
            rep.citizen || citizenId,
            incidentId,
            rep.imageUrl,
            rep.desc,
            rep.lat,
            rep.lng,
            address,
            rep.problem,
            category,
            rep.severity,
            rep.summary,
            twoDaysAgo
          ]
        );

        // Sync report to Supabase
        syncReport({
          id: reportId,
          citizen_id: rep.citizen || citizenId,
          incident_id: incidentId,
          image_url: rep.imageUrl,
          description: rep.desc,
          latitude: rep.lat,
          longitude: rep.lng,
          address,
          ai_problem: rep.problem,
          ai_category: category,
          ai_severity: rep.severity,
          ai_summary: rep.summary,
          created_at: twoDaysAgo
        });
      });

      // Sync incident to Supabase
      syncIncident({
        id: incidentId,
        category,
        severity,
        priority_score: priorityScore,
        status,
        latitude: lat,
        longitude: lng,
        address,
        assigned_worker: assignedWorker,
        assigned_crew_id: assignedCrewId,
        assigned_at: assignedWorker ? oneDayAgo : null,
        dispatch_notes: dispatchNotes,
        resolution_evidence_url: resolvedEvidence,
        resolution_notes: resolutionNotes,
        resolution_submitted_at: status === 'Resolution Submitted' || status === 'Resolution Rejected' || status === 'Closed' || status === 'Resolved' ? threeHoursAgo : null,
        rejection_reason: rejectionReason,
        rejected_at: rejectionReason ? oneHourAgo : null,
        rejected_by: rejectionReason ? adminId : null,
        approved_by: approvedBy,
        approved_at: status === 'Closed' ? oneHourAgo : null,
        resolved_at: status === 'Resolved' || status === 'Closed' ? threeHoursAgo : null,
        closed_at: status === 'Closed' ? oneHourAgo : null,
        created_at: twoDaysAgo,
        updated_at: new Date().toISOString()
      });

      // Sync history log to Supabase
      syncStatusHistory({
        id: hist1,
        incident_id: incidentId,
        status: 'Reported',
        changed_by: citizenId,
        notes: 'Citizen submitted report. AI vision categorized incident.',
        created_at: twoDaysAgo
      });
    }

    // --- SEED INCIDENTS COVERING ALL LIFECYCLE STAGES ---

    // 1. Pothole near India Gate (Status: Resolution Submitted — Awaiting Admin Approval!)
    seedIncidentAndReports({
      category: 'Road Infrastructure',
      severity: 'High',
      priorityScore: 85,
      status: 'Resolution Submitted',
      lat: 28.6129,
      lng: 77.2295,
      address: 'India Gate Circular Road, Delhi',
      assignedWorker: 'Rapid Response Dispatch Crew',
      assignedCrewId: crewId,
      dispatchNotes: 'Deploy cold-mix asphalt patching and level surface.',
      resolvedEvidence: imgResolved,
      resolutionNotes: 'Pothole excavated, filled with bitumen cold-mix, compacted and spray-sealed.',
      reports: [
        {
          imageUrl: imgPothole,
          desc: 'Very large pothole near India Gate roundabout, causing motorbikes to skid.',
          lat: 28.6130,
          lng: 77.2294,
          problem: 'Deep Pothole',
          severity: 'High',
          summary: 'Large deep pothole on the public roadway near a heavy traffic roundabout.'
        }
      ]
    });

    // 2. Open High-Voltage Wire near Lajpat Nagar (Status: Verified — Awaiting Dispatch Assignment)
    seedIncidentAndReports({
      category: 'Safety Hazards',
      severity: 'Critical',
      priorityScore: 95,
      status: 'Verified',
      lat: 28.5708,
      lng: 77.2412,
      address: 'Block D, Lajpat Nagar Central Market, Delhi',
      reports: [
        {
          imageUrl: imgWire,
          desc: 'Loose, naked electric wires hanging down from transformer right above the busy shopping lane.',
          lat: 28.5708,
          lng: 77.2412,
          problem: 'Exposed High-Voltage Wires',
          severity: 'Critical',
          summary: 'High risk hazard involving live overhead electricity cables sagging within pedestrian reach.'
        }
      ]
    });

    // 3. Water Pipe Burst near AIIMS Hospital (Status: Assigned — Awaiting Crew Acceptance)
    seedIncidentAndReports({
      category: 'Water Leakage',
      severity: 'High',
      priorityScore: 90,
      status: 'Assigned',
      lat: 28.5672,
      lng: 77.2100,
      address: 'Aurobindo Marg near AIIMS Metro gate, Delhi',
      assignedWorker: 'Rapid Response Dispatch Crew',
      assignedCrewId: crewId,
      dispatchNotes: 'Sewer & Pipe Isolation Unit needed. Shut valve at node 4.',
      reports: [
        {
          imageUrl: imgWater,
          desc: 'Water pipe burst near AIIMS Hospital, clean water flooding the metro entry.',
          lat: 28.5671,
          lng: 77.2101,
          problem: 'Water Pipe Burst',
          severity: 'High',
          summary: 'Active pipeline failure causing high water volume discharge and flooding.'
        }
      ]
    });

    // 4. Broken Streetlight near Red Fort (Status: In Progress — Crew On Site)
    seedIncidentAndReports({
      category: 'Safety Hazards',
      severity: 'Medium',
      priorityScore: 50,
      status: 'In Progress',
      lat: 28.6562,
      lng: 77.2410,
      address: 'Netaji Subhash Marg near Red Fort, Delhi',
      assignedWorker: 'Rapid Response Dispatch Crew',
      assignedCrewId: crewId,
      dispatchNotes: 'Inspect junction box #12 and replace LED fixture.',
      reports: [
        {
          imageUrl: imgLight,
          desc: 'Three streetlights are not working, the highway near Red Fort is completely dark.',
          lat: 28.6562,
          lng: 77.2410,
          problem: 'Broken Streetlight',
          severity: 'Medium',
          summary: 'Multiple consecutive non-functional streetlights resulting in poor road visibility.'
        }
      ]
    });

    // 5. Commercial Garbage Dump near Connaught Place (Status: Resolution Rejected — Rework in Progress)
    seedIncidentAndReports({
      category: 'Garbage / Dumping',
      severity: 'Medium',
      priorityScore: 40,
      status: 'Resolution Rejected',
      lat: 28.6304,
      lng: 77.2177,
      address: 'Outer Circle, Connaught Place, Delhi',
      assignedWorker: 'Rapid Response Dispatch Crew',
      assignedCrewId: crewId,
      dispatchNotes: 'Sanitation loader truck required.',
      resolvedEvidence: imgGarbage,
      resolutionNotes: 'Trash bags lifted from sidewalk.',
      rejectionReason: 'The secondary bin behind the kiosk is still overflowing and oil stains remain on the sidewalk. Please sanitize completely.',
      reports: [
        {
          imageUrl: imgGarbage,
          desc: 'Huge garbage pile overflowing near the block E entrance. Rotten smell.',
          lat: 28.6304,
          lng: 77.2177,
          problem: 'Garbage Dump',
          severity: 'Medium',
          summary: 'Overflowing commercial waste dump reported on the pedestrian footpath.'
        }
      ]
    });

    // 6. Traffic Obstruction on Pusa Road (Status: Closed — Formally Approved by Admin)
    seedIncidentAndReports({
      category: 'Traffic',
      severity: 'High',
      priorityScore: 70,
      status: 'Closed',
      lat: 28.6425,
      lng: 77.1885,
      address: 'Pusa Road, Karol Bagh, Delhi',
      assignedWorker: 'Traffic Police Unit 4',
      assignedCrewId: crewId,
      resolvedEvidence: imgResolved,
      resolutionNotes: 'Heavy cargo container towed away and lane opened for regular traffic.',
      approvedBy: adminId,
      reports: [
        {
          imageUrl: imgPothole,
          desc: 'An abandoned container is blocking two main lanes on Pusa Road, causing heavy traffic jams.',
          lat: 28.6425,
          lng: 77.1885,
          problem: 'Road Blockage',
          severity: 'High',
          summary: 'Lane obstruction due to large abandoned cargo object on an arterial road.'
        }
      ]
    });

    // 7. Waterlogging near Saket Metro (Status: Reported — Fresh Citizen Report)
    seedIncidentAndReports({
      category: 'Water Leakage',
      severity: 'High',
      priorityScore: 75,
      status: 'Reported',
      lat: 28.5222,
      lng: 77.2066,
      address: 'Saket Metro Station road, Delhi',
      reports: [
        {
          imageUrl: imgWater,
          desc: 'Heavy waterlogging near metro stairs. Commuters cannot cross.',
          lat: 28.5222,
          lng: 77.2066,
          problem: 'Waterlogging',
          severity: 'High',
          summary: 'Severe localized flooding disrupting public transit access.'
        }
      ]
    });

    console.log('[Demo Seed] Database seeded successfully with multi-role incidents.');
    res.json({
      success: true,
      message: 'Demo database seeded successfully with all lifecycle states.',
      credentials: {
        civilian: { email: 'citizen@gmail.com', password: '31102006' },
        admin: { email: 'admin@gmail.com', password: '31102006' },
        crew: { email: 'crew@gmail.com', password: '311102006' }
      }
    });

  } catch (err) {
    console.error('[Demo Seed Error] Seeding failed:', err);
    res.status(500).json({ error: 'Internal server error seeding database.' });
  }
});

// Clear Route (Public)
// Endpoint: POST /api/demo/clear
router.post('/clear', (req, res) => {
  try {
    console.log('[Demo Clear] Starting database clearing...');
    query.exec('PRAGMA foreign_keys = OFF;');
    query.exec('DELETE FROM incident_status_history;');
    query.exec('DELETE FROM reports;');
    query.exec('DELETE FROM incidents;');
    query.exec('DELETE FROM users;');
    query.exec('PRAGMA foreign_keys = ON;');
    
    // Also wipe Supabase tables
    clearSupabaseTables();

    console.log('[Demo Clear] Database cleared successfully.');
    res.json({
      success: true,
      message: 'Demo database cleared successfully.'
    });
  } catch (err) {
    console.error('[Demo Clear Error] Clearing failed:', err);
    res.status(500).json({ error: 'Internal server error clearing database.' });
  }
});

module.exports = router;
