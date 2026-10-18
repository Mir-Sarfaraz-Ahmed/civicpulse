const { supabase } = require('./supabase');

/**
 * Supabase Synchronization Helper
 * Safely mirrors all entity mutations to Supabase PostgreSQL without blocking API responses.
 */

async function syncIncident(incident) {
  if (!incident || !incident.id) return;
  try {
    const payload = {
      id: String(incident.id),
      category: incident.category,
      severity: incident.severity,
      priority_score: incident.priority_score,
      status: incident.status,
      latitude: incident.latitude,
      longitude: incident.longitude,
      address: incident.address || 'Delhi, India',
      assigned_worker: incident.assigned_worker || null,
      assigned_crew_id: incident.assigned_crew_id || null,
      assigned_at: incident.assigned_at || null,
      dispatch_notes: incident.dispatch_notes || null,
      resolution_evidence_url: incident.resolution_evidence_url || null,
      resolution_notes: incident.resolution_notes || null,
      resolution_submitted_at: incident.resolution_submitted_at || null,
      rejection_reason: incident.rejection_reason || null,
      rejected_at: incident.rejected_at || null,
      rejected_by: incident.rejected_by || null,
      approved_by: incident.approved_by || null,
      approved_at: incident.approved_at || null,
      resolved_at: incident.resolved_at || null,
      closed_at: incident.closed_at || null,
      external_lodging_status: incident.external_lodging_status || null,
      external_portal_name: incident.external_portal_name || null,
      external_reference_id: incident.external_reference_id || null,
      external_lodged_at: incident.external_lodged_at || null,
      external_lodging_details: incident.external_lodging_details || null,
      created_at: incident.created_at || new Date().toISOString(),
      updated_at: incident.updated_at || new Date().toISOString()
    };

    const { error } = await supabase.from('incidents').upsert([payload], { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync Warning: incidents]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Sync Exception: incidents]', err.message);
  }
}

async function syncReport(report) {
  if (!report || !report.id) return;
  try {
    const payload = {
      id: String(report.id),
      citizen_id: String(report.citizen_id),
      incident_id: report.incident_id ? String(report.incident_id) : null,
      image_url: report.image_url,
      description: report.description || '',
      latitude: report.latitude,
      longitude: report.longitude,
      address: report.address || 'Delhi, India',
      ai_problem: report.ai_problem || null,
      ai_category: report.ai_category || null,
      ai_severity: report.ai_severity || null,
      ai_summary: report.ai_summary || null,
      created_at: report.created_at || new Date().toISOString()
    };

    const { error } = await supabase.from('reports').upsert([payload], { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync Warning: reports]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Sync Exception: reports]', err.message);
  }
}

async function syncStatusHistory(history) {
  if (!history || !history.id) return;
  try {
    const payload = {
      id: String(history.id),
      incident_id: String(history.incident_id),
      status: history.status,
      changed_by: String(history.changed_by),
      notes: history.notes || '',
      created_at: history.created_at || new Date().toISOString()
    };

    const { error } = await supabase.from('incident_status_history').upsert([payload], { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync Warning: incident_status_history]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Sync Exception: incident_status_history]', err.message);
  }
}

async function deleteIncidentFromSupabase(incidentId) {
  try {
    await supabase.from('incidents').delete().eq('id', String(incidentId));
  } catch (err) {
    console.warn('[Supabase Delete Warning: incidents]', err.message);
  }
}

async function deleteReportFromSupabase(reportId) {
  try {
    await supabase.from('reports').delete().eq('id', String(reportId));
  } catch (err) {
    console.warn('[Supabase Delete Warning: reports]', err.message);
  }
}

async function clearSupabaseTables() {
  try {
    await supabase.from('incident_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('[Supabase Sync] Cleared Supabase incidents, reports, and history.');
  } catch (err) {
    console.warn('[Supabase Clear Warning]', err.message);
  }
}

module.exports = {
  syncIncident,
  syncReport,
  syncStatusHistory,
  deleteIncidentFromSupabase,
  deleteReportFromSupabase,
  clearSupabaseTables
};
