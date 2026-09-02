import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  ArrowLeft,
  ArrowRight, 
  Loader, 
  Clipboard, 
  Truck, 
  Check, 
  CheckCircle,
  CheckCheck,
  Upload, 
  AlertTriangle, 
  Users, 
  X, 
  Home, 
  LogOut, 
  RefreshCw,
  XCircle,
  Camera,
  Search
} from 'lucide-react';
import MapComponent from './MapComponent';
import { API_BASE, getImageUrl } from '../config';
import { db } from '../firebaseClient';
import { collection, onSnapshot } from 'firebase/firestore';

const PREDEFINED_WORKERS = [
  "Rapid Response Dispatch Crew (North)",
  "Rapid Response Dispatch Crew (Central)",
  "Amit Sharma (PWD Road Repair)",
  "Suresh Gupta (Delhi Jal Board)",
  "Rahul Kumar (BSES Electrical)",
  "Vikram Singh (MCD Sanitation)",
  "Traffic Police Dispatch Unit 4"
];

const PREDEFINED_DISPATCH = [
  "Deploying cold-mix pothole patching unit with vibratory roller.",
  "Dispatched electrical emergency crew with isolated boom lift.",
  "Sewer suction and jetting machine deployed to clear blockage.",
  "Sanitation dump loader and waste transport truck dispatched.",
  "Traffic diversion unit dispatched for immediate lane decongestion."
];

const REPORT_REJECTION_PRESETS = [
  "False Report / No Issue Found on Site",
  "Spam / Irrelevant or Inappropriate Content",
  "AI Misclassification / False Positive Detection",
  "Private Property / Outside Municipal Scope",
  "Issue Already Resolved / Cleared Previously",
  "Other (Specify Reason Below)"
];

export default function AdminDashboard({ token, user, onLogout, onBackToHome }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ 
    totalActive: 0, 
    critical: 0, 
    highPriority: 0, 
    resolved: 0, 
    rejected: 0,
    pendingApproval: 0,
    inProgress: 0,
    pendingVerification: 0 
  });
  const [loading, setLoading] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'critical', 'high', 'verification', 'active', 'approval', 'rejected', 'closed'
  const [searchQuery, setSearchQuery] = useState('');

  // Form Inputs for Actions
  const [workerName, setWorkerName] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRejectReportModal, setShowRejectReportModal] = useState(false);
  const [reportRejectionPreset, setReportRejectionPreset] = useState(REPORT_REJECTION_PRESETS[0]);
  const [customReportRejection, setCustomReportRejection] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Image Lightbox Popup Modal State
  const [modalImage, setModalImage] = useState(null);

  // Scroll state for smooth collapsing header animation
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${API_BASE}/incidents/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsRes.ok) setStats(statsData);

      // 2. Fetch Incidents List
      const listRes = await fetch(`${API_BASE}/incidents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const listData = await listRes.json();
      if (listRes.ok && Array.isArray(listData)) setIncidents(listData);

    } catch (err) {
      console.error('[Admin Dashboard Error] Failed to load data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [token]);

  const fetchIncidentDetails = useCallback(async (id, showLoading = true) => {
    if (showLoading) setLoadingDetails(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedDetails(data);
      } else {
        setActionError(data.error || 'Failed to load details.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error loading details.');
    } finally {
      if (showLoading) setLoadingDetails(false);
    }
  }, [token]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalImage(null);
        setShowRejectModal(false);
        setShowRejectReportModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedIncidentIdRef = React.useRef(null);
  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
  }, [selectedIncidentId]);

  useEffect(() => {
    fetchDashboardData(true);

    // Attach Firestore real-time listener
    let unsubscribe = null;
    try {
      const incidentsCol = collection(db, 'incidents');
      unsubscribe = onSnapshot(incidentsCol, () => {
        fetchDashboardData(false);
        if (selectedIncidentIdRef.current) {
          fetchIncidentDetails(selectedIncidentIdRef.current, false);
        }
      }, (err) => {
        console.warn('[Firestore Admin Listener Warning]', err.message);
      });
    } catch (e) {
      console.warn('[Firestore Setup Warning]', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [token, fetchDashboardData, fetchIncidentDetails]);

  useEffect(() => {
    if (selectedIncidentId) {
      fetchIncidentDetails(selectedIncidentId, true);
    }
  }, [selectedIncidentId, fetchIncidentDetails]);

  // Perform PATCH actions for state transitions
  const handleTransition = async (endpoint, payload = {}) => {
    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/incidents/${selectedIncidentId}/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Status updated to: ${data.status}`);
        // Reset forms
        setWorkerName('');
        setDispatchNotes('');
        setActionNotes('');
        setRejectionReason('');
        setShowRejectModal(false);
        setShowRejectReportModal(false);
        setCustomReportRejection('');
        // Reload dashboard list & details
        fetchDashboardData(false);
        fetchIncidentDetails(selectedIncidentId, false);
      } else {
        setActionError(data.error || 'Failed to execute transition.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error during action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectReport = () => {
    const finalReason = reportRejectionPreset === 'Other (Specify Reason Below)'
      ? (customReportRejection.trim() || 'False Report / Invalid Issue')
      : (customReportRejection.trim() ? `${reportRejectionPreset}: ${customReportRejection.trim()}` : reportRejectionPreset);

    handleTransition('reject', { rejectionReason: finalReason });
  };

  // Dedicated resolve handler (multipart/form-data for image evidence)
  const handleResolveIncident = async (e) => {
    e.preventDefault();
    if (!evidenceFile) {
      setActionError('Resolution evidence image is required to resolve.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    const formData = new FormData();
    formData.append('evidence', evidenceFile);
    formData.append('notes', actionNotes || 'Issue verified and repaired on site.');

    try {
      const res = await fetch(`${API_BASE}/incidents/${selectedIncidentId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Resolution submitted for administrative review.');
        setEvidenceFile(null);
        setActionNotes('');
        fetchDashboardData(false);
        fetchIncidentDetails(selectedIncidentId, false);
      } else {
        setActionError(data.error || 'Failed to submit resolution.');
      }
    } catch (err) {
      console.error(err);
      setActionError('Network error during resolution upload.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getSeverityBadgeClass = (sev) => {
    switch (sev) {
      case 'Critical': return 'badge-critical';
      case 'High': return 'badge-high';
      case 'Medium': return 'badge-medium';
      case 'Low': return 'badge-low';
      default: return 'badge-low';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Reported':
      case 'Under Review':
      case 'AI Analysed': return 'var(--primary-neon)';
      case 'Verified': return '#00b4d8';
      case 'Assigned': return 'var(--color-medium)';
      case 'Accepted': return 'var(--primary-neon)';
      case 'Dispatched':
      case 'In Progress': return 'var(--color-high)';
      case 'Resolution Submitted': return 'var(--secondary-neon)';
      case 'Resolution Rejected': return 'var(--color-critical)';
      case 'Rejected': return 'var(--color-critical)';
      case 'Resolved':
      case 'Closed': return 'var(--color-low)';
      default: return 'var(--text-muted)';
    }
  };

  // Filter incidents based on active filter tab and search query
  const filteredIncidents = incidents.filter(inc => {
    // 1. Tab filter
    let matchesTab = true;
    if (filterTab === 'critical') {
      matchesTab = inc.severity === 'Critical' && inc.status !== 'Closed' && inc.status !== 'Rejected';
    } else if (filterTab === 'high') {
      matchesTab = inc.severity === 'High' && inc.status !== 'Closed' && inc.status !== 'Rejected';
    } else if (filterTab === 'verification') {
      matchesTab = inc.status === 'Reported' || inc.status === 'Under Review' || inc.status === 'AI Analysed';
    } else if (filterTab === 'active') {
      matchesTab = ['Verified', 'Assigned', 'Accepted', 'In Progress', 'Dispatched'].includes(inc.status);
    } else if (filterTab === 'approval') {
      matchesTab = inc.status === 'Resolution Submitted';
    } else if (filterTab === 'rework') {
      matchesTab = inc.status === 'Resolution Rejected';
    } else if (filterTab === 'rejected') {
      matchesTab = inc.status === 'Rejected';
    } else if (filterTab === 'closed') {
      matchesTab = inc.status === 'Closed' || inc.status === 'Resolved';
    }

    if (!matchesTab) return false;

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cat = (inc.category || '').toLowerCase();
      const addr = (inc.address || '').toLowerCase();
      const worker = (inc.assigned_worker || '').toLowerCase();
      const status = (inc.status || '').toLowerCase();
      return cat.includes(q) || addr.includes(q) || worker.includes(q) || status.includes(q);
    }

    return true;
  });

  return (
    <div className="admin-portal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '60px' }}>
      
      {/* 1. Header Navbar - Sleek & Dynamic Centered Collapsing Bar on Scroll */}
      <header 
        className="navbar" 
        style={{ 
          minHeight: isScrolled ? '46px' : '64px',
          padding: isScrolled ? '4px 0' : '10px 0', 
          display: 'flex',
          alignItems: 'center',
          borderBottom: isScrolled ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid var(--border-light)', 
          background: isScrolled ? 'rgba(7, 9, 19, 0.95)' : 'rgba(7, 9, 19, 0.88)', 
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky', 
          top: 0, 
          zIndex: 1000,
          boxShadow: isScrolled ? '0 4px 20px rgba(0,0,0,0.6), 0 0 10px rgba(0, 242, 254, 0.05)' : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="container flex-row-between" style={{ flexWrap: 'nowrap', gap: '10px', alignItems: 'center', width: '100%' }}>
          
          {/* Logo / Title Area */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 
              style={{ 
                fontSize: isScrolled ? '1.05rem' : '1.5rem', 
                fontWeight: 800, 
                fontFamily: 'var(--font-title)', 
                letterSpacing: '-0.02em', 
                margin: 0, 
                lineHeight: 1.15,
                transition: 'font-size 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <span style={{ color: '#00f2fe' }}>Authority </span>
              <span style={{ color: '#c084fc' }}>Command Center</span>
            </h1>
            <p 
              style={{ 
                fontSize: '0.8rem', 
                color: 'var(--text-muted)', 
                margin: isScrolled ? '0' : '3px 0 0 0',
                maxHeight: isScrolled ? '0px' : '20px',
                opacity: isScrolled ? 0 : 1,
                overflow: 'hidden',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                whiteSpace: 'nowrap'
              }}
            >
              AI-powered Incident Priorities and Grouping Dashboard
            </p>
          </div>

          {/* Controls Area */}
          <div style={{ display: 'flex', gap: isScrolled ? '6px' : '10px', alignItems: 'center', flexShrink: 0 }}>
            
            {/* User Profile Badge */}
            <div 
              title={`${user?.name || 'City Municipal Admin'} (${user?.email || 'admin@gmail.com'})`}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isScrolled ? '0px' : '8px', 
                background: isScrolled ? 'transparent' : 'rgba(16, 22, 40, 0.8)', 
                border: isScrolled ? '1px solid transparent' : '1px solid var(--border-light)', 
                padding: isScrolled ? '0px' : '5px 10px', 
                borderRadius: isScrolled ? '50%' : '8px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div 
                style={{ 
                  width: isScrolled ? '28px' : '28px', 
                  height: isScrolled ? '28px' : '28px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #ec4899, #be185d)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: 700, 
                  fontSize: isScrolled ? '0.78rem' : '0.8rem', 
                  color: '#fff',
                  boxShadow: isScrolled ? '0 0 8px rgba(236, 72, 153, 0.4)' : 'none',
                  border: isScrolled ? '1.5px solid rgba(236, 72, 153, 0.7)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {(user?.name || 'C').charAt(0).toUpperCase()}
              </div>

              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  lineHeight: 1.15,
                  maxWidth: isScrolled ? '0px' : '220px',
                  opacity: isScrolled ? 0 : 1,
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{user?.name || 'Admin'}</span>
                  <span style={{ fontSize: '0.62rem', background: '#e11d48', color: '#fff', padding: '1px 4px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                    ADMIN
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.email || 'admin@gmail.com'}</span>
              </div>
            </div>

            {/* Refresh Button */}
            <button 
              onClick={() => fetchDashboardData(true)} 
              className="btn btn-secondary" 
              title="Refresh Incident Feeds"
              style={{ 
                padding: isScrolled ? '6px' : '6px 12px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px', 
                borderRadius: isScrolled ? '50%' : '8px',
                minWidth: isScrolled ? '28px' : 'auto',
                height: isScrolled ? '28px' : 'auto',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <RefreshCw size={13} />
              <span 
                style={{ 
                  maxWidth: isScrolled ? '0px' : '60px', 
                  opacity: isScrolled ? 0 : 1, 
                  overflow: 'hidden', 
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                  whiteSpace: 'nowrap' 
                }}
              >
                Refresh
              </span>
            </button>

            {/* Home Button */}
            <button 
              onClick={onBackToHome} 
              className="btn btn-secondary" 
              title="Return to Home Portal"
              style={{ 
                padding: isScrolled ? '6px' : '6px 12px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px', 
                borderRadius: isScrolled ? '50%' : '8px',
                minWidth: isScrolled ? '28px' : 'auto',
                height: isScrolled ? '28px' : 'auto',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Home size={13} />
              <span 
                style={{ 
                  maxWidth: isScrolled ? '0px' : '50px', 
                  opacity: isScrolled ? 0 : 1, 
                  overflow: 'hidden', 
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                  whiteSpace: 'nowrap' 
                }}
              >
                Home
              </span>
            </button>

            {/* Sign Out Button */}
            <button 
              onClick={onLogout} 
              className="btn" 
              title="Sign Out of Authority Console"
              style={{ 
                padding: isScrolled ? '6px' : '6px 12px', 
                fontSize: '0.8rem', 
                border: '1px solid rgba(225, 29, 72, 0.5)', 
                background: 'rgba(225, 29, 72, 0.1)', 
                color: '#fb7185', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px', 
                borderRadius: isScrolled ? '50%' : '8px',
                minWidth: isScrolled ? '28px' : 'auto',
                height: isScrolled ? '28px' : 'auto',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <LogOut size={13} />
              <span 
                style={{ 
                  maxWidth: isScrolled ? '0px' : '70px', 
                  opacity: isScrolled ? 0 : 1, 
                  overflow: 'hidden', 
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                  whiteSpace: 'nowrap' 
                }}
              >
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="container" style={{ marginTop: '20px', flexGrow: 1 }}>
        
        {/* KPI Header Grid - 5 Compact & Sleek Cards */}
        <div className="admin-kpi-grid">
          <div 
            className="kpi-card" 
            onClick={() => setFilterTab('all')} 
            style={{ 
              cursor: 'pointer', 
              borderColor: filterTab === 'all' ? '#00f2fe' : undefined,
              background: filterTab === 'all' ? 'rgba(0, 242, 254, 0.08)' : undefined 
            }}
          >
            <div className="kpi-label">ACTIVE INCIDENTS</div>
            <div className="kpi-value" style={{ color: '#00f2fe' }}>{stats.totalActive || 0}</div>
          </div>
          
          <div 
            className="kpi-card" 
            onClick={() => setFilterTab('critical')} 
            style={{ 
              cursor: 'pointer', 
              borderColor: filterTab === 'critical' ? '#ff0055' : undefined,
              background: filterTab === 'critical' ? 'rgba(255, 0, 85, 0.08)' : undefined 
            }}
          >
            <div className="kpi-label">CRITICAL ISSUES</div>
            <div className="kpi-value" style={{ color: '#ff0055' }}>{stats.critical || 0}</div>
          </div>
          
          <div 
            className="kpi-card" 
            onClick={() => setFilterTab('high')} 
            style={{ 
              cursor: 'pointer', 
              borderColor: filterTab === 'high' ? '#ff9900' : undefined,
              background: filterTab === 'high' ? 'rgba(255, 153, 0, 0.08)' : undefined 
            }}
          >
            <div className="kpi-label">HIGH PRIORITY</div>
            <div className="kpi-value" style={{ color: '#ff9900' }}>{stats.highPriority || 0}</div>
          </div>
          
          <div 
            className="kpi-card" 
            onClick={() => setFilterTab('closed')} 
            style={{ 
              cursor: 'pointer', 
              borderColor: filterTab === 'closed' ? '#00e676' : undefined,
              background: filterTab === 'closed' ? 'rgba(0, 230, 118, 0.08)' : undefined 
            }}
          >
            <div className="kpi-label">RESOLVED</div>
            <div className="kpi-value" style={{ color: '#00e676' }}>{stats.resolved || 0}</div>
          </div>
          
          <div 
            className="kpi-card" 
            onClick={() => setFilterTab('approval')} 
            style={{ 
              cursor: 'pointer', 
              borderColor: filterTab === 'approval' ? '#c084fc' : undefined,
              background: filterTab === 'approval' ? 'rgba(192, 132, 252, 0.08)' : undefined 
            }}
          >
            <div className="kpi-label">PENDING REVIEW</div>
            <div className="kpi-value" style={{ color: '#ffffff' }}>{(stats.pendingApproval || 0) + (stats.pendingVerification || 0)}</div>
          </div>
        </div>

        {/* 3. Full-Width Interactive GIS Map */}
        <div 
          className="glass-card" 
          style={{ 
            padding: '0', 
            overflow: 'hidden', 
            height: '440px', 
            marginBottom: '24px', 
            border: '1px solid var(--border-light)', 
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
            position: 'relative'
          }}
        >
          <MapComponent 
            mode="view" 
            incidents={incidents} 
            activeIncidentId={selectedIncidentId}
            onIncidentSelect={(id) => {
              setSelectedIncidentId(id);
              const detailEl = document.getElementById('selected-incident-inspector');
              if (detailEl) detailEl.scrollIntoView({ behavior: 'smooth' });
            }} 
          />
        </div>

        {/* 4. Incident Section: Full Grid when NOT selected, Rich Inspector when Selected */}
        <div id="selected-incident-inspector" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* VIEW A: NO INCIDENT SELECTED -> SHOW FULL WIDTH FEED GRID */}
          {!selectedIncidentId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Header & Filter Controls Bar */}
              <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-title)', color: '#fff', margin: 0 }}>
                    Priority Incidents Feed
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                    {filteredIncidents.length} items
                  </span>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search incidents or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px 6px 32px', fontSize: '0.8rem', borderRadius: '8px', width: '100%' }}
                  />
                  {searchQuery && (
                    <X size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
                  )}
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setFilterTab('all')} 
                    className={`btn ${filterTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px' }}
                  >
                    All ({incidents.length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('critical')} 
                    className={`btn ${filterTab === 'critical' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px', borderColor: filterTab === 'critical' ? undefined : 'rgba(255,0,85,0.4)' }}
                  >
                    Critical ({incidents.filter(i => i.severity === 'Critical' && i.status !== 'Closed' && i.status !== 'Rejected').length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('high')} 
                    className={`btn ${filterTab === 'high' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px', borderColor: filterTab === 'high' ? undefined : 'rgba(255,153,0,0.4)' }}
                  >
                    High ({incidents.filter(i => i.severity === 'High' && i.status !== 'Closed' && i.status !== 'Rejected').length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('verification')} 
                    className={`btn ${filterTab === 'verification' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px', borderColor: filterTab === 'verification' ? undefined : 'rgba(0,242,254,0.4)' }}
                  >
                    Needs Verification ({incidents.filter(i => i.status === 'Reported' || i.status === 'Under Review' || i.status === 'AI Analysed').length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('approval')} 
                    className={`btn ${filterTab === 'approval' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px', borderColor: filterTab === 'approval' ? undefined : 'rgba(192,132,252,0.4)' }}
                  >
                    Pending Approval ({incidents.filter(i => i.status === 'Resolution Submitted').length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('active')} 
                    className={`btn ${filterTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px' }}
                  >
                    In Dispatch ({incidents.filter(i => ['Verified', 'Assigned', 'Accepted', 'In Progress', 'Dispatched'].includes(i.status)).length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('rejected')} 
                    className={`btn ${filterTab === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px', borderColor: filterTab === 'rejected' ? undefined : 'rgba(255,0,85,0.4)', color: filterTab === 'rejected' ? undefined : 'var(--color-critical)' }}
                  >
                    Rejected / False ({incidents.filter(i => i.status === 'Rejected').length})
                  </button>
                  <button 
                    onClick={() => setFilterTab('closed')} 
                    className={`btn ${filterTab === 'closed' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '6px' }}
                  >
                    Resolved ({incidents.filter(i => ['Closed', 'Resolved'].includes(i.status)).length})
                  </button>
                </div>
              </div>

              {/* Full Width Grid of Incident Cards */}
              {loading ? (
                <div className="flex-row-center" style={{ minHeight: '220px' }}>
                  <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={28} className="neon-text" />
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    No incidents match the active filter or search query.
                  </p>
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                  gap: '16px', 
                  alignItems: 'stretch' 
                }}>
                  {filteredIncidents.map(inc => (
                    <div 
                      key={inc.id}
                      onClick={() => {
                        setSelectedIncidentId(inc.id);
                        const detailEl = document.getElementById('selected-incident-inspector');
                        if (detailEl) detailEl.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="glass-card glass-card-interactive"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderRadius: '12px',
                        border: inc.status === 'Resolution Submitted' ? '1px solid rgba(192, 132, 252, 0.4)' : (inc.status === 'Resolution Rejected' ? '1px solid rgba(255,0,85,0.4)' : '1px solid var(--border-light)'),
                        background: 'rgba(16, 22, 40, 0.65)'
                      }}
                    >
                      <div>
                        <div className="flex-row-between" style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="priority-circle" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                              {inc.priority_score}
                            </span>
                            <div>
                              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', margin: 0 }}>
                                {inc.category}
                              </h3>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ID: #{inc.id}
                              </span>
                            </div>
                          </div>
                          <span className={`badge ${getSeverityBadgeClass(inc.severity)}`}>
                            {inc.severity}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.3 }}>
                          <MapPin size={13} style={{ flexShrink: 0, color: 'var(--primary-neon)' }} /> 
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inc.address || 'Delhi Region'}
                          </span>
                        </div>

                        {inc.assigned_worker && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '4px' }}>
                            <span style={{ color: 'var(--primary-neon)' }}>Crew: </span>{inc.assigned_worker}
                          </div>
                        )}

                        {inc.status === 'Rejected' && inc.rejection_reason && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-critical)', marginBottom: '8px', background: 'rgba(255,0,85,0.08)', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Dismissed: {inc.rejection_reason}
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '6px' }}>
                        <div className="flex-row-between" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                          <span style={{ color: getStatusColor(inc.status), fontWeight: 600 }}>
                            ● {inc.status === 'Rejected' ? 'Rejected (False Report)' : inc.status}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {inc.report_count || 1} Citizen Report{inc.report_count > 1 ? 's' : ''}
                          </span>
                        </div>

                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%', 
                            padding: '6px 12px', 
                            fontSize: '0.8rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            borderRadius: '6px' 
                          }}
                        >
                          Inspect & Manage <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ) : (
            /* VIEW B: INCIDENT SELECTED -> DEDICATED MASTER-DETAIL INSPECTOR */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Back to All Incidents Navigation Header */}
              <div className="glass-card" style={{ padding: '12px 18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setSelectedIncidentId(null)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                  >
                    <ArrowLeft size={14} /> Back to Incident List
                  </button>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Inspecting Incident #{selectedIncidentId}
                    </span>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                      {selectedDetails?.incident?.category || 'Loading Incident...'}
                    </h2>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedDetails?.incident && (
                    <>
                      <span className={`badge ${getSeverityBadgeClass(selectedDetails.incident.severity)}`}>
                        {selectedDetails.incident.severity}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: getStatusColor(selectedDetails.incident.status), fontWeight: 600 }}>
                        ● {selectedDetails.incident.status}
                      </span>
                      <div className="priority-circle" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                        {selectedDetails.incident.priority_score}
                      </div>
                    </>
                  )}
                  <button 
                    onClick={() => setSelectedIncidentId(null)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 8px', borderRadius: '8px', color: 'var(--text-muted)' }}
                    title="Close Inspector"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Inspector Content */}
              {loadingDetails ? (
                <div className="glass-card flex-row-center" style={{ minHeight: '350px' }}>
                  <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={32} className="neon-text" />
                </div>
              ) : selectedDetails ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1fr)', gap: '20px', alignItems: 'start' }}>
                  
                  {/* LEFT COLUMN: Overview, Reports, Lifecycle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 1. Incident Overview Details */}
                    <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#fff' }}>
                        Incident Location & Metadata
                      </h3>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary-neon)' }} /> <strong>Address:</strong> {selectedDetails.incident.address}</div>
                        <div><strong>GPS Coordinates:</strong> {selectedDetails.incident.latitude?.toFixed(5)}, {selectedDetails.incident.longitude?.toFixed(5)}</div>
                        <div><strong>Assigned Crew:</strong> <span style={{ color: 'var(--primary-neon)', fontWeight: 600 }}>{selectedDetails.incident.assigned_worker || 'Unassigned'}</span></div>
                        {selectedDetails.incident.dispatch_notes && (
                          <div><strong>Dispatch Directive:</strong> {selectedDetails.incident.dispatch_notes}</div>
                        )}
                        <div><strong>Date Reported:</strong> {new Date(selectedDetails.incident.created_at).toLocaleString()}</div>
                      </div>

                      {/* Rejection notice banner if active */}
                      {selectedDetails.incident.status === 'Resolution Rejected' && (
                        <div style={{ background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.3)', borderRadius: '8px', padding: '12px 14px', marginTop: '14px' }}>
                          <div style={{ color: 'var(--color-critical)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={15} /> Admin Rejection Feedback Issued
                          </div>
                          <p style={{ color: '#fff', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                            {selectedDetails.incident.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 2. Clustered Citizen Reports */}
                    <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={16} /> Clustered Citizen Reports ({selectedDetails.reports?.length || 0})
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedDetails.reports?.map((rep, idx) => (
                          <div key={rep.id || idx} style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {rep.image_url && (
                              <img 
                                src={getImageUrl(rep.image_url)} 
                                alt="Report" 
                                onClick={() => setModalImage(getImageUrl(rep.image_url))}
                                style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                              />
                            )}
                            <div style={{ flex: 1, fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                <span><strong>Citizen:</strong> {rep.citizen_name || 'Resident'}</span>
                                <span>{new Date(rep.created_at).toLocaleDateString()}</span>
                              </div>
                              <p style={{ color: '#fff', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                                {rep.description || rep.ai_summary || 'Citizen report filed via portal.'}
                              </p>
                              {rep.ai_problem && (
                                <span style={{ fontSize: '0.75rem', background: 'rgba(0,242,254,0.1)', color: 'var(--primary-neon)', padding: '2px 6px', borderRadius: '4px' }}>
                                  AI Tag: {rep.ai_problem}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Lifecycle Audit Trail */}
                    <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clipboard size={16} /> Incident Lifecycle Audit Trail
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedDetails.history?.map((h, idx) => (
                          <div key={h.id || idx} style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', borderLeft: '2px solid var(--primary-neon)', paddingLeft: '10px', marginLeft: '4px' }}>
                            <div>
                              <span style={{ color: getStatusColor(h.status), fontWeight: 600 }}>{h.status}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>by {h.actor_name || 'System'} ({new Date(h.created_at).toLocaleTimeString()})</span>
                              {h.notes && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                                  {h.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: Proof Comparison & Action Center */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Resolution Proof Comparison Card */}
                    {selectedDetails.incident.resolution_evidence_url && (
                      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ fontSize: '0.95rem', color: 'var(--secondary-neon)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Camera size={16} /> Resolution Verification: Before & After
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {/* Before Photo */}
                          <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                              BEFORE (Citizen Report)
                            </div>
                            {selectedDetails.reports?.[0]?.image_url ? (
                              <img 
                                src={getImageUrl(selectedDetails.reports[0].image_url)} 
                                alt="Before Problem"
                                onClick={() => setModalImage(getImageUrl(selectedDetails.reports[0].image_url))}
                                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }}
                              />
                            ) : (
                              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Before Photo</div>
                            )}
                          </div>

                          {/* After Photo */}
                          <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '8px', padding: '8px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-low)', marginBottom: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={11} /> AFTER (Crew Proof)
                            </div>
                            <img 
                              src={getImageUrl(selectedDetails.incident.resolution_evidence_url)} 
                              alt="After Resolution"
                              onClick={() => setModalImage(getImageUrl(selectedDetails.incident.resolution_evidence_url))}
                              style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--color-low)' }}
                            />
                          </div>
                        </div>

                        {selectedDetails.incident.resolution_notes && (
                          <div style={{ fontSize: '0.8rem', color: '#fff', marginTop: '10px', background: 'rgba(0, 230, 118, 0.05)', padding: '8px', borderRadius: '6px' }}>
                            <strong>Crew Notes:</strong> {selectedDetails.incident.resolution_notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Authority Decision & Action Controls */}
                    <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-neon)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Authority Decision & Action
                      </h4>

                      {actionError && (
                        <div style={{ color: '#ff4d88', fontSize: '0.85rem', marginBottom: '10px', background: 'rgba(255,0,85,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                          ⚠️ {actionError}
                        </div>
                      )}
                      {actionSuccess && (
                        <div style={{ color: 'var(--color-low)', fontSize: '0.85rem', marginBottom: '10px', background: 'rgba(0,230,118,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                          ✓ {actionSuccess}
                        </div>
                      )}

                      {/* ACTION 1: Verify Incident or Reject False Report */}
                      {(selectedDetails.incident.status === 'Reported' || selectedDetails.incident.status === 'Under Review' || selectedDetails.incident.status === 'AI Analysed') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => handleTransition('verify', { notes: 'Incident verified by authority.' })}
                              disabled={submittingAction}
                              className="btn btn-primary"
                              style={{ flex: 1.3, minWidth: '180px', padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                              {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <Check size={14} />}
                              Verify Incident & Push to Dispatch
                            </button>

                            <button 
                              type="button"
                              onClick={() => {
                                setReportRejectionPreset(REPORT_REJECTION_PRESETS[0]);
                                setCustomReportRejection('');
                                setShowRejectReportModal(true);
                              }}
                              disabled={submittingAction}
                              className="btn btn-danger"
                              style={{ flex: 0.9, minWidth: '140px', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <XCircle size={15} />
                              Reject Report (False / Invalid)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACTION: Handle Rejected Reports */}
                      {selectedDetails.incident.status === 'Rejected' && (
                        <div style={{ background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.3)', padding: '14px 16px', borderRadius: '10px' }}>
                          <div style={{ color: 'var(--color-critical)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <XCircle size={16} /> Report Rejected / Archived
                          </div>
                          <p style={{ color: '#e2e8f0', fontSize: '0.83rem', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                            <strong>Rejection Reason:</strong> {selectedDetails.incident.rejection_reason || 'Marked as false report / duplicate by municipal authority.'}
                          </p>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Action Taken by: <strong>{selectedDetails.incident.rejected_by || 'Authority Admin'}</strong> {selectedDetails.incident.rejected_at ? `on ${new Date(selectedDetails.incident.rejected_at).toLocaleString()}` : ''}
                          </div>
                          <button 
                            onClick={() => handleTransition('verify', { notes: 'Re-evaluated and approved for dispatch by authority.' })}
                            disabled={submittingAction}
                            className="btn btn-secondary"
                            style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <RefreshCw size={13} /> Re-open & Verify for Dispatch
                          </button>
                        </div>
                      )}

                      {/* ACTION 2: Assign Dispatch Crew */}
                      {selectedDetails.incident.status === 'Verified' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Select or Enter Dispatch Crew:</label>
                          <select 
                            value={workerName}
                            onChange={(e) => setWorkerName(e.target.value)}
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Choose Field Response Unit --</option>
                            {PREDEFINED_WORKERS.map(w => (
                              <option key={w} value={w}>{w}</option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            placeholder="Or enter custom crew / officer name..."
                            value={workerName}
                            onChange={(e) => setWorkerName(e.target.value)}
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                          />
                          <select 
                            value={dispatchNotes}
                            onChange={(e) => setDispatchNotes(e.target.value)}
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Choose Dispatch Directive --</option>
                            {PREDEFINED_DISPATCH.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <textarea 
                            rows={2}
                            placeholder="Custom dispatch instructions..."
                            value={dispatchNotes}
                            onChange={(e) => setDispatchNotes(e.target.value)}
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => handleTransition('assign', { workerName, dispatchNotes })}
                              disabled={submittingAction || !workerName}
                              className="btn btn-primary"
                              style={{ flex: 1.5, minWidth: '180px', padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                              {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <Truck size={14} />}
                              Assign & Dispatch Crew
                            </button>

                            <button 
                              type="button"
                              onClick={() => {
                                setReportRejectionPreset(REPORT_REJECTION_PRESETS[0]);
                                setCustomReportRejection('');
                                setShowRejectReportModal(true);
                              }}
                              disabled={submittingAction}
                              className="btn btn-secondary"
                              style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--color-critical)', borderColor: 'rgba(255,0,85,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <XCircle size={14} /> Reject Report
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACTION 3: Crew Assigned / In Progress Information */}
                      {(selectedDetails.incident.status === 'Assigned' || selectedDetails.incident.status === 'Accepted' || selectedDetails.incident.status === 'In Progress') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--primary-neon)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                              ● Crew Active on Field: {selectedDetails.incident.assigned_worker}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              Current State: <strong>{selectedDetails.incident.status}</strong>. Waiting for crew to upload after-repair photo evidence.
                            </div>
                          </div>

                          {/* Optional Admin Direct Evidence Upload Override */}
                          <div style={{ background: 'rgba(10,15,30,0.5)', border: '1px solid var(--border-light)', padding: '14px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Admin Direct Resolution Override:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                              <input 
                                type="text"
                                placeholder="Admin resolution notes (optional)..."
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                              <button 
                                onClick={handleResolveIncident}
                                disabled={submittingAction || !evidenceFile}
                                className="btn btn-secondary"
                                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                              >
                                {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <Upload size={14} />}
                                Directly Submit Evidence & Resolve
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ACTION 4: APPROVAL / REJECTION DECISION */}
                      {(selectedDetails.incident.status === 'Resolution Submitted' || selectedDetails.incident.status === 'Resolved') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Review the submitted before/after photos above. Choose whether to accept the work or request rework from the field crew:
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {/* Approve Button */}
                            <button 
                              onClick={() => handleTransition('approve', { notes: 'Resolution verified and officially approved by Municipal Admin.' })}
                              disabled={submittingAction}
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '10px 14px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #00e676, #00b0ff)', borderColor: '#00e676' }}
                            >
                              {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <CheckCheck size={16} />}
                              Approve & Close
                            </button>

                            {/* Reject Button */}
                            <button 
                              onClick={() => setShowRejectModal(true)}
                              disabled={submittingAction}
                              className="btn btn-danger"
                              style={{ flex: 1, padding: '10px 14px', fontSize: '0.85rem' }}
                            >
                              <XCircle size={16} />
                              Reject (Rework)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACTION 5: Closed Indicator */}
                      {selectedDetails.incident.status === 'Closed' && (
                        <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CheckCircle size={20} style={{ color: 'var(--color-low)' }} />
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong style={{ color: 'var(--color-low)' }}>Incident Formally Closed & Archived</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              Resolution verified and recorded in municipal audit logs.
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Quick Switch to Other Incidents */}
                    <div className="glass-card" style={{ padding: '16px', borderRadius: '12px' }}>
                      <div className="flex-row-between" style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Other Priority Incidents
                        </span>
                        <button 
                          onClick={() => setSelectedIncidentId(null)}
                          className="btn-text" 
                          style={{ fontSize: '0.75rem', color: 'var(--primary-neon)', cursor: 'pointer', background: 'none', border: 'none' }}
                        >
                          View All Grid →
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                        {incidents.filter(i => i.id !== selectedIncidentId).slice(0, 5).map(other => (
                          <div 
                            key={other.id}
                            onClick={() => setSelectedIncidentId(other.id)}
                            style={{ 
                              padding: '8px 10px', 
                              background: 'rgba(10,15,30,0.4)', 
                              border: '1px solid var(--border-light)', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: '#fff' }}>{other.category}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>#{other.id}</span>
                            </div>
                            <span style={{ color: getStatusColor(other.status), fontSize: '0.75rem' }}>
                              ● {other.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              ) : null}

            </div>
          )}

        </div>

      </main>

      {/* RESOLUTION REJECTION MODAL */}
      {showRejectModal && (
        <div 
          onClick={() => setShowRejectModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              borderColor: 'rgba(255,0,85,0.4)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              borderRadius: '14px'
            }}
          >
            <div className="flex-row-between" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-critical)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <AlertTriangle size={18} /> Reject Resolution & Request Rework
              </h3>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowRejectModal(false)} />
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
              Please specify why the resolution is rejected. This feedback will be sent directly to the dispatch crew for required on-site rework.
            </p>

            <textarea 
              rows={4}
              placeholder="e.g., The secondary pothole is not filled properly, and asphalt debris is left on the footpath..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="form-input"
              required
              style={{ width: '100%', fontSize: '0.85rem', marginBottom: '16px', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowRejectModal(false)} 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={submittingAction || !rejectionReason.trim()}
                onClick={() => handleTransition('reject-resolution', { rejectionReason })}
                className="btn btn-danger"
                style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <XCircle size={14} />}
                Confirm Rejection & Notify Crew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INITIAL INCIDENT FALSE REPORT REJECTION MODAL */}
      {showRejectReportModal && (
        <div 
          onClick={() => setShowRejectReportModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(5px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              borderColor: 'rgba(255,0,85,0.5)',
              boxShadow: '0 12px 45px rgba(0,0,0,0.85)',
              borderRadius: '14px'
            }}
          >
            <div className="flex-row-between" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--color-critical)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 700 }}>
                <XCircle size={20} /> Reject Incident Report
              </h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowRejectReportModal(false)} />
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px', lineHeight: 1.5 }}>
              Rejecting this incident prevents false alarms, spam, or duplicates from accumulating in the active dispatch queue. It will be archived and logged in the municipal audit trail.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '6px', display: 'block' }}>
                Select Rejection Classification:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {REPORT_REJECTION_PRESETS.map((preset) => (
                  <label 
                    key={preset}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: reportRejectionPreset === preset ? 'rgba(255,0,85,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${reportRejectionPreset === preset ? 'rgba(255,0,85,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      color: reportRejectionPreset === preset ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="reportRejectionPreset" 
                      checked={reportRejectionPreset === preset}
                      onChange={() => setReportRejectionPreset(preset)}
                      style={{ accentColor: 'var(--color-critical)' }}
                    />
                    {preset}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '6px', display: 'block' }}>
                Additional Notes / Officer Remarks (Optional):
              </label>
              <textarea 
                rows={3}
                placeholder="Add specific details on why this report was dismissed..."
                value={customReportRejection}
                onChange={(e) => setCustomReportRejection(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowRejectReportModal(false)} 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={submittingAction}
                onClick={handleRejectReport}
                className="btn btn-danger"
                style={{ padding: '8px 18px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {submittingAction ? <Loader size={14} style={{ animation: 'spin 1s infinite linear' }} /> : <XCircle size={14} />}
                Confirm Rejection & Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
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

