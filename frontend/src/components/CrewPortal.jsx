import React, { useState, useEffect, useCallback } from 'react';
import { TruckIcon } from './ui/TruckIcon';
import { 
  Truck, 
  Wrench, 
  MapPin, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Camera, 
  Upload, 
  FileText, 
  CheckSquare, 
  ArrowRight, 
  Loader, 
  RotateCcw, 
  X, 
  Eye, 
  ZoomIn, 
  Maximize2, 
  ExternalLink, 
  LogOut, 
  Home, 
  RefreshCw, 
  ShieldCheck
} from 'lucide-react';
import { API_BASE, getImageUrl } from '../config';
import { supabase, uploadToSupabaseStorage } from '../supabaseClient';

export default function CrewPortal({ token, user, onLogout, onBackToHome }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('active'); // 'active', 'all', 'needs_rework', 'submitted'
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Resolution Submission Form States
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Lightbox Modal Image
  const [modalImage, setModalImage] = useState(null);

  // Close modal on Escape
  // Close image modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedTaskIdRef = React.useRef(null);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTask ? selectedTask.id : null;
  }, [selectedTask]);

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/incidents/crew/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTasks(data);
        // If selected task is open, update its reference functionally
        setSelectedTask(prevSelected => {
          if (!prevSelected) return null;
          const updated = data.find(t => t.id === prevSelected.id);
          return updated || prevSelected;
        });
      }
    } catch (err) {
      console.error('[Crew Portal Error] Failed to fetch tasks:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [token]);

  // Fetch tasks initially and on token change
  useEffect(() => {
    fetchTasks(true);

    // Attach Supabase Realtime listener for live crew task updates
    let channel = null;
    try {
      channel = supabase
        .channel('crew-incidents-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
          fetchTasks(false);
        })
        .subscribe();
    } catch (e) {
      console.warn('[Supabase Realtime Crew Setup Warning]', e);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [token, fetchTasks]);

  // Handle Photo picker for Resolution Evidence
  const handleEvidenceFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEvidenceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setActionError(null);
    }
  };

  // 1. Crew Accepts Job (Assigned -> Accepted)
  const handleAcceptJob = async (taskId) => {
    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/incidents/${taskId}/crew-accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: 'Dispatch crew accepted assignment and is mobilizing.' })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Job accepted! Proceed to site location.');
        fetchTasks(false);
      } else {
        setActionError(data.error || 'Failed to accept job.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error accepting job.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 2. Crew Starts Work / Arrives On Site (Accepted or Rejected -> In Progress)
  const handleStartWork = async (taskId) => {
    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/incidents/${taskId}/crew-start`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: 'Crew arrived at coordinates and initiated repair.' })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Status updated: In Progress on site.');
        fetchTasks(false);
      } else {
        setActionError(data.error || 'Failed to start work.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error starting work.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 3. Crew Submits Resolution (In Progress -> Resolution Submitted)
  const handleSubmitResolution = async (e, taskId) => {
    e.preventDefault();
    if (!evidenceFile) {
      setActionError('Resolution photo evidence is required before submission.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    let supabaseEvidenceUrl = null;
    try {
      supabaseEvidenceUrl = await uploadToSupabaseStorage(evidenceFile, 'resolutions', user?.id || 'crew');
    } catch (uploadErr) {
      console.warn('[Direct Crew Supabase Upload Note]:', uploadErr.message);
    }

    const formData = new FormData();
    formData.append('evidence', evidenceFile);
    if (supabaseEvidenceUrl) {
      formData.append('evidenceUrl', supabaseEvidenceUrl);
    }
    formData.append('resolutionNotes', resolutionNotes || 'Repairs completed according to standard municipal guidelines.');

    try {
      const res = await fetch(`${API_BASE}/incidents/${taskId}/crew-submit-resolution`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Resolution submitted! Pending Admin verification and approval.');
        setEvidenceFile(null);
        setEvidencePreview(null);
        setResolutionNotes('');
        setSelectedTask(null);
        fetchTasks(false);
      } else {
        setActionError(data.error || 'Failed to submit resolution.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error submitting resolution.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Assigned':
        return <span className="badge" style={{ background: 'rgba(255, 170, 0, 0.15)', color: 'var(--color-medium)', border: '1px solid rgba(255, 170, 0, 0.3)' }}>Assigned</span>;
      case 'Accepted':
        return <span className="badge" style={{ background: 'rgba(0, 242, 254, 0.15)', color: 'var(--primary-neon)', border: '1px solid rgba(0, 242, 254, 0.3)' }}>Accepted</span>;
      case 'In Progress':
      case 'Dispatched':
        return <span className="badge badge-high">In Progress</span>;
      case 'Resolution Submitted':
        return <span className="badge" style={{ background: 'rgba(155, 81, 224, 0.15)', color: 'var(--secondary-neon)', border: '1px solid rgba(155, 81, 224, 0.3)' }}>Awaiting Approval</span>;
      case 'Resolution Rejected':
        return <span className="badge badge-critical">Needs Rework</span>;
      case 'Closed':
      case 'Resolved':
        return <span className="badge badge-low">Approved & Closed</span>;
      default:
        return <span className="badge badge-low">{status}</span>;
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'needs_rework') return t.status === 'Resolution Rejected';
    if (activeFilter === 'submitted') return t.status === 'Resolution Submitted';
    if (activeFilter === 'active') return t.status === 'Assigned' || t.status === 'Accepted' || t.status === 'In Progress' || t.status === 'Resolution Rejected';
    return true; // 'all'
  });

  const stats = {
    total: tasks.length,
    assigned: tasks.filter(t => t.status === 'Assigned').length,
    inProgress: tasks.filter(t => t.status === 'In Progress' || t.status === 'Accepted').length,
    awaitingApproval: tasks.filter(t => t.status === 'Resolution Submitted').length,
    needsRework: tasks.filter(t => t.status === 'Resolution Rejected').length
  };

  return (
    <div className="admin-portal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '60px' }}>
      
      {/* 1. Header Navbar */}
      <header className="navbar">
        <div className="container flex-row-between" style={{ height: '100%' }}>
          <div className="nav-logo flex-row-center" style={{ gap: '10px' }}>
            <TruckIcon size={24} className="neon-text" />
            <span>Naagrik Dispatch Crew</span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,170,0,0.15)', color: 'var(--color-medium)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,170,0,0.3)', fontWeight: 600 }}>
              FIELD RESPONSE UNIT
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} className="hide-mobile">
              Officer: <strong style={{ color: '#fff' }}>{user?.name || 'Field Crew'}</strong>
            </span>
            <button onClick={onBackToHome} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <Home size={14} /> Home
            </button>
            <button onClick={onLogout} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="container" style={{ marginTop: '24px', flexGrow: 1 }}>
        
        {/* KPI Banner */}
        <div className="grid-4" style={{ gap: '16px', marginBottom: '24px' }}>
          <div className="kpi-card" onClick={() => setActiveFilter('active')} style={{ cursor: 'pointer', borderLeft: '4px solid var(--primary-neon)' }}>
            <div className="kpi-label">Active Field Jobs</div>
            <div className="kpi-value text-gradient">{stats.assigned + stats.inProgress + stats.needsRework}</div>
          </div>
          <div className="kpi-card" onClick={() => setActiveFilter('needs_rework')} style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-critical)' }}>
            <div className="kpi-label">Rework Required</div>
            <div className="kpi-value" style={{ color: 'var(--color-critical)' }}>{stats.needsRework}</div>
          </div>
          <div className="kpi-card" onClick={() => setActiveFilter('submitted')} style={{ cursor: 'pointer', borderLeft: '4px solid var(--secondary-neon)' }}>
            <div className="kpi-label">Awaiting Admin Review</div>
            <div className="kpi-value" style={{ color: 'var(--secondary-neon)' }}>{stats.awaitingApproval}</div>
          </div>
          <div className="kpi-card" onClick={() => setActiveFilter('all')} style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-low)' }}>
            <div className="kpi-label">Total Assigned Pool</div>
            <div className="kpi-value" style={{ color: 'var(--color-low)' }}>{stats.total}</div>
          </div>
        </div>

        {/* Global Notifications */}
        {actionError && (
          <div style={{ color: '#ff4d88', background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>⚠️ {actionError}</span>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setActionError(null)} />
          </div>
        )}
        {actionSuccess && (
          <div style={{ color: 'var(--color-low)', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>✓ {actionSuccess}</span>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setActionSuccess(null)} />
          </div>
        )}

        {/* Filters & Refresh Header */}
        <div className="flex-row-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveFilter('active')} 
              className={`btn ${activeFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Active Tasks ({stats.assigned + stats.inProgress + stats.needsRework})
            </button>
            <button 
              onClick={() => setActiveFilter('needs_rework')} 
              className={`btn ${activeFilter === 'needs_rework' ? 'btn-danger' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Rework Feedback ({stats.needsRework})
            </button>
            <button 
              onClick={() => setActiveFilter('submitted')} 
              className={`btn ${activeFilter === 'submitted' ? 'btn-secondary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', borderColor: activeFilter === 'submitted' ? 'var(--secondary-neon)' : undefined }}
            >
              Awaiting Approval ({stats.awaitingApproval})
            </button>
            <button 
              onClick={() => setActiveFilter('all')} 
              className={`btn ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              All
            </button>
          </div>

          <button onClick={() => fetchTasks(true)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Task Cards List */}
        {loading ? (
          <div className="flex-row-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={32} className="neon-text" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading dispatched tasks from Firestore...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="glass-card flex-row-center" style={{ minHeight: '220px', flexDirection: 'column', textAlign: 'center', padding: '40px' }}>
            <CheckCircle size={40} style={{ color: 'var(--color-low)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>No Pending Tasks</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px' }}>
              All assigned field repairs in this category are completed or currently being processed.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredTasks.map(task => (
              <div 
                key={task.id} 
                className="glass-card" 
                style={{ 
                  padding: '20px', 
                  borderColor: task.status === 'Resolution Rejected' ? 'rgba(255,0,85,0.4)' : (task.status === 'Resolution Submitted' ? 'rgba(155,81,224,0.3)' : 'var(--border-light)'),
                  boxShadow: task.status === 'Resolution Rejected' ? '0 0 15px rgba(255,0,85,0.1)' : undefined
                }}
              >
                
                {/* Rejection Alert Banner if Rework is required */}
                {task.status === 'Resolution Rejected' && (
                  <div style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid rgba(255, 0, 85, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-critical)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                      <AlertTriangle size={16} /> Admin Rejection & Rework Request
                    </div>
                    <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                      <strong>Feedback:</strong> {task.rejection_reason || 'Inadequate resolution proof or incomplete work. Please address and resubmit.'}
                    </p>
                  </div>
                )}

                {/* Card Header */}
                <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="priority-circle" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                      {task.priority_score || 50}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
                        {task.category}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <MapPin size={12} /> {task.address || 'Delhi Area'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getStatusBadge(task.status)}
                    <span className={`badge ${task.severity === 'Critical' ? 'badge-critical' : task.severity === 'High' ? 'badge-high' : 'badge-medium'}`}>
                      {task.severity}
                    </span>
                  </div>
                </div>

                {/* Dispatch Notes from Admin */}
                {task.dispatch_notes && (
                  <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.15)', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--primary-neon)' }}>Dispatch Instructions:</strong> {task.dispatch_notes}
                  </div>
                )}

                {/* Initial Citizen Report Snapshot */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', background: 'rgba(10,15,30,0.5)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  {task.first_report_image && (
                    <img 
                      src={getImageUrl(task.first_report_image)} 
                      alt="Reported Issue" 
                      onClick={() => setModalImage(getImageUrl(task.first_report_image))}
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                    />
                  )}
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <strong>Citizen Description:</strong> {task.first_report_desc || 'Problem reported by local resident.'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Location GPS: {task.latitude?.toFixed(4)}, {task.longitude?.toFixed(4)} &bull; Linked Reports: {task.report_count || 1}
                    </div>
                  </div>
                </div>

                {/* Uploaded Evidence Preview if already submitted */}
                {task.resolution_evidence_url && (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
                    <img 
                      src={getImageUrl(task.resolution_evidence_url)} 
                      alt="Resolution Proof" 
                      onClick={() => setModalImage(getImageUrl(task.resolution_evidence_url))}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-low)', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--color-low)', fontWeight: 600 }}>Uploaded Resolution Evidence</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Notes: {task.resolution_notes || 'Repairs completed.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Stepper Controls */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  
                  {/* Step 1: Accept Assignment */}
                  {task.status === 'Assigned' && (
                    <button 
                      onClick={() => handleAcceptJob(task.id)} 
                      disabled={submittingAction}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <CheckSquare size={14} />}
                      Accept Task & Mobilize
                    </button>
                  )}

                  {/* Step 2: Start Work On-Site */}
                  {task.status === 'Accepted' && (
                    <button 
                      onClick={() => handleStartWork(task.id)} 
                      disabled={submittingAction}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <Wrench size={14} />}
                      Arrive On-Site & Start Work
                    </button>
                  )}

                  {/* Step 2b: Resume Rework after Rejection */}
                  {task.status === 'Resolution Rejected' && (
                    <button 
                      onClick={() => handleStartWork(task.id)} 
                      disabled={submittingAction}
                      className="btn btn-danger"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <RotateCcw size={14} />}
                      Resume Rework On-Site
                    </button>
                  )}

                  {/* Step 3: Open Resolution Submission Drawer */}
                  {task.status === 'In Progress' && (
                    <button 
                      onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)} 
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      <Camera size={14} />
                      {selectedTask?.id === task.id ? 'Close Resolution Panel' : 'Capture & Submit Resolution Proof'}
                    </button>
                  )}

                  {/* Step 4: Status Indicator when Submitted */}
                  {task.status === 'Resolution Submitted' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary-neon)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Clock size={16} /> Awaiting Municipal Admin Review & Sign-Off
                    </div>
                  )}

                  {/* Step 5: Status Indicator when Closed */}
                  {(task.status === 'Closed' || task.status === 'Resolved') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-low)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <CheckCircle size={16} /> Formally Approved & Archived by Authority
                    </div>
                  )}
                </div>

                {/* Resolution Submission Panel Drawer */}
                {selectedTask?.id === task.id && task.status === 'In Progress' && (
                  <form 
                    onSubmit={(e) => handleSubmitResolution(e, task.id)}
                    style={{ marginTop: '16px', padding: '16px', background: 'rgba(0, 242, 254, 0.03)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '8px' }}
                  >
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--primary-neon)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Camera size={16} /> Upload Resolution Evidence & Field Notes
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                      {/* Image Picker */}
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Upload After-Repair Photo *</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleEvidenceFileChange} 
                          className="form-input" 
                          required 
                          style={{ padding: '6px', fontSize: '0.8rem' }}
                        />
                        {evidencePreview && (
                          <div style={{ marginTop: '8px', position: 'relative' }}>
                            <img 
                              src={evidencePreview} 
                              alt="Preview" 
                              style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)' }} 
                            />
                          </div>
                        )}
                      </div>

                      {/* Work Description Notes */}
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Resolution Summary / Work Done *</label>
                        <textarea 
                          rows={4}
                          placeholder="Describe the materials used and exact repairs performed on site..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="form-input"
                          required
                          style={{ fontSize: '0.85rem', resize: 'vertical' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button 
                        type="button" 
                        onClick={() => setSelectedTask(null)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={submittingAction || !evidenceFile}
                        className="btn btn-primary" 
                        style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                      >
                        {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <Upload size={14} />}
                        Submit for Admin Approval
                      </button>
                    </div>
                  </form>
                )}

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Image Lightbox Popup Modal */}
      {modalImage && (
        <div 
          onClick={() => setModalImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(6px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
            }}
          >
            <button 
              onClick={() => setModalImage(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              <X size={20} />
            </button>
            <img 
              src={modalImage} 
              alt="Evidence Full View" 
              style={{ display: 'block', maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
