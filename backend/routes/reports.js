const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { processReportGrouping } = require('../utils/incidentEngine');

const router = express.Router();

// Configure in-memory upload storage (Zero local disk writes, direct to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'));
    }
  }
});

// Heuristic Fallback Analysis in case Google Gemini is unconfigured or fails
function runHeuristicFallback(description, originalFilename) {
  const text = `${description || ''} ${originalFilename || ''}`.toLowerCase();
  
  let problem = 'Civic Issue';
  let category = 'Other';
  let severity = 'Medium';
  let summary = 'A civic problem has been reported and requires inspection.';

  if (text.includes('pothole') || text.includes('road') || text.includes('asphalt') || text.includes('tarmac') || text.includes('street damage')) {
    problem = 'Pothole / Road Damage';
    category = 'Road Infrastructure';
    severity = 'High';
    summary = 'Pothole or road surface disintegration reported on the street.';
  } else if (text.includes('bridge') || text.includes('flyover') || text.includes('pillar') || text.includes('collapse') || text.includes('structural')) {
    problem = 'Structural Damage';
    category = 'Damaged Infrastructure';
    severity = 'Critical';
    summary = 'Significant structural cracking or partial failure reported on critical infrastructure.';
  } else if (text.includes('streetlight') || text.includes('street light') || text.includes('dark') || text.includes('lamp') || text.includes('bulb')) {
    problem = 'Broken Streetlight';
    category = 'Safety Hazards';
    severity = 'Medium';
    summary = 'Non-operational streetlight reported, creating dark zones and safety hazards.';
  } else if (text.includes('traffic') || text.includes('signal') || text.includes('light green') || text.includes('light red') || text.includes('congestion')) {
    problem = 'Signal Failure / Traffic Congestion';
    category = 'Traffic';
    severity = 'Medium';
    summary = 'Traffic light malfunction or severe road blockage reported.';
  } else if (text.includes('water') || text.includes('leak') || text.includes('pipe') || text.includes('sewage') || text.includes('drain')) {
    problem = 'Water Leakage / Pipe Burst';
    category = 'Water Leakage';
    severity = 'High';
    summary = 'Water pipeline leak or sewer overflow causing pooling and water wastage.';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump') || text.includes('bin') || text.includes('refuse')) {
    problem = 'Garbage Accumulation';
    category = 'Garbage / Dumping';
    severity = 'Medium';
    summary = 'Accumulated refuse or illegal waste dumping reported on public land.';
  }

  return { problem, category, severity, summary, isFallback: true };
}

// Helper to clean JSON string from Gemini code fences
function cleanGeminiJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  return cleaned;
}

const { uploadToStorage, supabase } = require('../supabase');
const { deleteReportFromSupabase, deleteIncidentFromSupabase } = require('../supabaseSync');

// 1. Upload & Analyze Image with AI (Protected)
// Endpoint: POST /api/reports/analyze
router.post('/analyze', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file && !req.body.imageUrl && (!req.body.description || !req.body.description.trim())) {
    return res.status(400).json({ error: 'An image or issue description is required to analyze.' });
  }

  const { description, latitude, longitude } = req.body;
  const userId = req.user?.id || 'citizen';
  let imageUrl = req.body.imageUrl || '';

  // Upload buffer directly to Supabase Storage in user's folder if not already uploaded
  if (req.file && !imageUrl) {
    try {
      const storageUrl = await uploadToStorage(req.file.buffer, req.file.originalname, req.file.mimetype, 'reports', userId);
      if (storageUrl) {
        imageUrl = storageUrl;
        console.log(`[Supabase Storage] Report image saved to user folder: ${imageUrl}`);
      }
    } catch (storageErr) {
      console.warn('[Supabase Storage Warning] Upload error:', storageErr.message);
    }
  }

  const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_BACKUP_KEY].filter(Boolean);

  if (apiKeys.length === 0) {
    console.warn('[AI Layer] No GEMINI_API_KEY defined. Using local heuristics engine.');
    const analysis = runHeuristicFallback(description, req.file ? req.file.originalname : 'issue.txt');
    return res.json({
      imageUrl,
      analysis
    });
  }

  try {
    // Convert memory buffer to base64 for Gemini multimodal input
    const imageBase64 = req.file ? req.file.buffer.toString('base64') : '';
    
    // Construct prompt
    const promptText = `
You are the CivicPulse AI analysis engine. Analyze this civic incident report based on the provided details${req.file ? ' and uploaded photo' : ''}.
Incident description / voice note: "${description || 'None'}"
Location coordinates: "${latitude || 'unknown'}, ${longitude || 'unknown'}"

You MUST respond with a valid JSON object matching the following structure:
{
  "problem": "Name of the problem, e.g. Pothole, Broken Streetlight, Trash Pile, Water Leakage",
  "category": "One of: Road Infrastructure, Damaged Infrastructure, Safety Hazards, Traffic, Water Leakage, Garbage / Dumping, Other",
  "severity": "One of: Low, Medium, High, Critical",
  "summary": "A concise, single-sentence summary of the detected problem and its surroundings."
}

Provide ONLY the raw JSON object, without markdown syntax or triple backticks.
`;

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];

    let textOutput = null;
    let successfulModel = null;

    // Try available keys and candidate models
    for (const key of apiKeys) {
      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const parts = [{ text: promptText }];
          if (imageBase64) {
            parts.push({
              inlineData: {
                mimeType: req.file.mimetype || 'image/jpeg',
                data: imageBase64
              }
            });
          }

          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{ parts }]
            })
          });

          if (response.ok) {
            const responseData = await response.json();
            const output = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (output) {
              textOutput = output;
              successfulModel = model;
              break;
            }
          } else {
            const errText = await response.text();
            console.warn(`[AI Layer] Model ${model} returned ${response.status}: ${errText.slice(0, 100)}`);
          }
        } catch (modelErr) {
          console.warn(`[AI Layer] Model ${model} request failed:`, modelErr.message);
        }
      }
      if (textOutput) break;
    }

    if (!textOutput) {
      throw new Error('All Gemini models and API keys failed to return output.');
    }

    console.log(`[AI Layer] Raw Gemini output from ${successfulModel}:`, textOutput);
    
    // Parse the output
    const cleanedJson = cleanGeminiJsonResponse(textOutput);
    const parsedAnalysis = JSON.parse(cleanedJson);

    // Validate the parsed structure
    const validCategories = [
      'Road Infrastructure', 'Damaged Infrastructure', 'Safety Hazards', 
      'Traffic', 'Water Leakage', 'Garbage / Dumping', 'Other'
    ];
    const validSeverities = ['Low', 'Medium', 'High', 'Critical'];

    const analysis = {
      problem: parsedAnalysis.problem || 'Civic Issue',
      category: validCategories.includes(parsedAnalysis.category) ? parsedAnalysis.category : 'Other',
      severity: validSeverities.includes(parsedAnalysis.severity) ? parsedAnalysis.severity : 'Medium',
      summary: parsedAnalysis.summary || 'Civic issue detected via automated scan.',
      isFallback: false
    };

    res.json({
      imageUrl,
      analysis
    });

  } catch (err) {
    console.error('[AI Layer Error] Gemini integration failed. Falling back to heuristics:', err.message);
    const analysis = runHeuristicFallback(description, req.file?.originalname || '');
    res.json({
      imageUrl,
      analysis
    });
  }
});

// 2. Final Submit Report (Protected)
// Endpoint: POST /api/reports/submit
router.post('/submit', requireAuth, (req, res) => {
  const {
    imageUrl,
    description,
    latitude,
    longitude,
    address,
    ai_problem,
    ai_category,
    ai_severity,
    ai_summary
  } = req.body;

  // Validate inputs
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude coordinates are required.' });
  }

  if (!ai_problem || !ai_category || !ai_severity) {
    return res.status(400).json({ error: 'AI analysis properties are required.' });
  }

  const reportId = uuidv4();
  const citizenId = req.user.id;

  try {
    // 1. Insert the report
    query.run(
      `INSERT INTO reports (id, citizen_id, incident_id, image_url, description, latitude, longitude, address, ai_problem, ai_category, ai_severity, ai_summary, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        citizenId,
        imageUrl,
        description || '',
        parseFloat(latitude),
        parseFloat(longitude),
        address || 'Delhi, India',
        ai_problem,
        ai_category,
        ai_severity,
        ai_summary || '',
        new Date().toISOString()
      ]
    );

    // 2. Run Duplicate Grouping and Priority Score calculation
    const reportData = {
      category: ai_category,
      severity: ai_severity,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      description: description || '',
      address: address || 'Delhi, India',
      citizenId
    };

    const incidentId = processReportGrouping(reportId, reportData);

    // Sync report to Supabase reports table
    try {
      supabase.from('reports').insert([{
        id: reportId,
        citizen_id: citizenId,
        incident_id: incidentId,
        image_url: imageUrl,
        description: description || '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || 'Delhi, India',
        ai_problem,
        ai_category,
        ai_severity,
        ai_summary: ai_summary || ''
      }]).then(({ error }) => {
        if (error) console.warn('[Supabase Reports Sync Warning]', error.message);
      });
    } catch (supaErr) {
      console.warn('[Supabase Reports Sync Error]', supaErr.message);
    }

    console.log(`[Reports] New report submitted: ID=${reportId}, Linked to Incident=${incidentId}`);

    res.status(201).json({
      success: true,
      reportId,
      incidentId,
      message: 'Report submitted and queued successfully.'
    });
  } catch (err) {
    console.error('[Reports Error] Failed to submit report:', err);
    res.status(500).json({ error: 'Internal server error during submission.' });
  }
});

// 3. Civilian "My Reports" List (Protected)
// Endpoint: GET /api/reports/my-reports
router.get('/my-reports', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const dbId = req.user.dbId || userId;
    const userEmail = req.user.email || '';

    const reports = query.all(
      `SELECT r.*, i.status, i.priority_score, i.assigned_worker, i.dispatch_notes, i.resolution_evidence_url, i.resolved_at, i.closed_at
       FROM reports r
       LEFT JOIN incidents i ON r.incident_id = i.id
       WHERE r.citizen_id = ? OR r.citizen_id = ? OR r.citizen_id IN (SELECT id FROM users WHERE email = ?)
       ORDER BY r.created_at DESC`,
      [userId, dbId, userEmail]
    );
    res.json(reports || []);
  } catch (err) {
    console.error('[Reports Error] Failed to fetch citizen reports:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3.5. Civilian Report Details & Authority Action History (Protected)
// Endpoint: GET /api/reports/:id/details
router.get('/:id/details', requireAuth, (req, res) => {
  const reportId = req.params.id;

  try {
    const report = query.get('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (report.citizen_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You do not own this report.' });
    }

    let incident = null;
    let history = [];

    if (report.incident_id) {
      incident = query.get('SELECT * FROM incidents WHERE id = ?', [report.incident_id]);
      history = query.all(
        `SELECT h.*, COALESCE(u.name, 'Authority Officer') as actor_name
         FROM incident_status_history h
         LEFT JOIN users u ON h.changed_by = u.id
         WHERE h.incident_id = ?
         ORDER BY h.created_at ASC`,
        [report.incident_id]
      );
    }

    res.json({
      report,
      incident: incident || {
        status: 'Reported',
        priority_score: 50,
        category: report.ai_category,
        severity: report.ai_severity
      },
      history
    });
  } catch (err) {
    console.error('[Reports Error] Failed to fetch report details:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. Civilian Delete/Withdraw Report (Protected, Owner only)
// Endpoint: DELETE /api/reports/:id
router.delete('/:id', requireAuth, (req, res) => {
  const reportId = req.params.id;

  try {
    // Verify report ownership
    const report = query.get('SELECT * FROM reports WHERE id = ?', [reportId]);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (report.citizen_id !== req.user.id) {
      console.warn(`[Security Alert] User ${req.user.email} attempted to delete report ${reportId} owned by ${report.citizen_id}`);
      return res.status(403).json({ error: 'Forbidden: You do not own this report.' });
    }

    const incidentId = report.incident_id;

    // Delete report from DB and Supabase
    query.run('DELETE FROM reports WHERE id = ?', [reportId]);
    deleteReportFromSupabase(reportId);
    console.log(`[Reports] Report ${reportId} deleted by user ${req.user.email}`);

    // If report was linked to an incident, check if that incident has any reports left
    if (incidentId) {
      const remainingRow = query.get('SELECT COUNT(*) as count FROM reports WHERE incident_id = ?', [incidentId]);
      const remainingCount = remainingRow ? remainingRow.count : 0;

      if (remainingCount === 0) {
        // No reports left, delete the incident entirely
        query.run('DELETE FROM incidents WHERE id = ?', [incidentId]);
        query.run('DELETE FROM incident_status_history WHERE incident_id = ?', [incidentId]);
        deleteIncidentFromSupabase(incidentId);
        console.log(`[Reports] Deleted orphaned incident ${incidentId} since all reports were withdrawn.`);
      } else {
        // Re-evaluate incident priority based on remaining reports
        const reportsList = query.all('SELECT * FROM reports WHERE incident_id = ?', [incidentId]);
        
        // Find highest severity among remaining reports
        const severityLevels = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
        let highestSeverity = 'Low';
        let mainDescription = '';

        reportsList.forEach(r => {
          if (severityLevels[r.ai_severity] > severityLevels[highestSeverity]) {
            highestSeverity = r.ai_severity;
          }
          if (r.description) {
            mainDescription += ' ' + r.description;
          }
        });

        const incident = query.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
        const { calculatePriorityScore } = require('../utils/incidentEngine');
        const newScore = calculatePriorityScore(incident.category, highestSeverity, mainDescription, remainingCount);

        query.run(
          'UPDATE incidents SET severity = ?, priority_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [highestSeverity, newScore, incidentId]
        );

        console.log(`[Reports] Incident ${incidentId} updated. Remaining reports count: ${remainingCount}. New score: ${newScore}`);
      }
    }

    res.json({ success: true, message: 'Report withdrawn successfully.' });
  } catch (err) {
    console.error('[Reports Error] Failed to delete report:', err);
    res.status(500).json({ error: 'Internal server error during deletion.' });
  }
});

module.exports = router;
