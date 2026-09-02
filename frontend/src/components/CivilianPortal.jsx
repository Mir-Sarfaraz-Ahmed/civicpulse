import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Image, PlusCircle, List, ArrowLeft, ArrowRight, Loader, Check, Trash2, HelpCircle, Eye, Shield, CheckCircle, Clock, X, ZoomIn, Maximize2, ExternalLink, User, Home, LogOut } from 'lucide-react';
import MapComponent from './MapComponent';
import { API_BASE, getImageUrl } from '../config';

export default function CivilianPortal({ token, user, onLogout, onBackToHome }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'report'
  const [reports, setReports] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form Reporting States
  const [reportStep, setReportStep] = useState(1); // 1: Image, 2: Location, 3: AI Analysis, 4: Success
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.2295, address: 'Delhi, India' });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  
  // Action Loading states
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Tracking & Authority Action Details Modal State
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [modalImage, setModalImage] = useState(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalImage) setModalImage(null);
        else if (selectedReportId) setSelectedReportId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalImage, selectedReportId]);

  const fetchMyReports = useCallback(async () => {
    setLoadingList(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`${API_BASE}/reports/my-reports`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setReports(data);
      } else {
        setErrorMsg(data.error || 'Failed to load reports.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error fetching reports.');
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  // Fetch civilian reports on load
  useEffect(() => {
    if (activeTab === 'list') {
      fetchMyReports();
    }
  }, [activeTab, fetchMyReports]);

  // Fetch complete timeline and authority actions for a single report
  const handleOpenTracking = async (reportId) => {
    setSelectedReportId(reportId);
    setLoadingTracking(true);
    setTrackingDetails(null);
    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setTrackingDetails(data);
      } else {
        alert(data.error || 'Failed to load tracking details.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error loading tracking details.');
    } finally {
      setLoadingTracking(false);
    }
  };

  // Handle Image picker change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setErrorMsg(null);
    }
  };


  // Submit final report to database
  const handleSubmitReport = async () => {
    if (!aiAnalysis) return;
    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      imageUrl: aiAnalysis.imageUrl || '', // returned from analyze step as temporary url
      description,
      latitude: location.lat,
      longitude: location.lng,
      address: location.address,
      ai_problem: aiAnalysis.problem,
      ai_category: aiAnalysis.category,
      ai_severity: aiAnalysis.severity,
      ai_summary: aiAnalysis.summary
    };

    // If image url is not in analysis root, let's use the analysis request result url
    if (aiAnalysis.imageUrl === undefined) {
      // Find the url returned alongside analysis
      // In the backend response: { imageUrl: "/uploads/file.png", analysis: { problem: ... } }
      // So we must handle how the analysis state was saved.
      // We will look for how we set state in handleRunAnalysis
    }

    try {
      // Set image url correctly from our state structure
      // Wait, in handleRunAnalysis: setAiAnalysis(data.analysis); and image url was data.imageUrl.
      // Let's pass the correct imageUrl from response
      const response = await fetch(`${API_BASE}/reports/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          imageUrl: selectedImage ? (window.lastUploadedUrl || aiAnalysis.imageUrl || '') : ''
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setTrackingId(data.reportId);
        setReportStep(4); // Success step
      } else {
        setErrorMsg(data.error || 'Submission failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error submitting report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Modify handleRunAnalysis to store the uploaded image URL returned from Express
  const handleRunAnalysisAndUpload = async () => {
    if (!selectedImage) {
      setErrorMsg('Please select or capture an image first.');
      return;
    }
    setAnalyzing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('description', description);
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);

    try {
      const response = await fetch(`${API_BASE}/reports/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        // Save the image URL in a global or state variable so we can use it in final submission
        window.lastUploadedUrl = data.imageUrl;
        setAiAnalysis(data.analysis);
        setReportStep(3); // Move to review step
      } else {
        setErrorMsg(data.error || 'AI analysis failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error during AI analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Withdraw/Delete report
  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to permanently delete/withdraw this report? This action is irreversible.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        fetchMyReports(); // reload list
      } else {
        alert(data.error || 'Failed to delete report.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting report.');
    }
  };

  // Clean form and restart
  const resetForm = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setDescription('');
    setLocation({ lat: 28.6139, lng: 77.2295, address: 'Delhi, India' });
    setAiAnalysis(null);
    setTrackingId(null);
    setReportStep(1);
    setErrorMsg(null);
    setActiveTab('list');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Reported':
      case 'Under Review': return '#9ca3af';
      case 'AI Analysed': return '#9b51e0';
      case 'Verified': return '#4facfe';
      case 'Assigned':
      case 'Accepted': return '#00f2fe';
      case 'Dispatched': return '#ffcc00';
      case 'In Progress': return '#ff6b00';
      case 'Resolution Submitted': return '#9b51e0';
      case 'Resolution Rejected': return '#ff0055';
      case 'Rejected': return '#ff0055';
      case 'Resolved': return '#00e676';
      case 'Closed': return '#059669';
      default: return '#fff';
    }
  };

  return (
    <div className="civilian-portal container" style={{ paddingTop: '30px', paddingBottom: '80px' }}>
      
      {/* Portal Top Header */}
      <div className="flex-row-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Civilian Reporting Center</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Submit and monitor local urban incidents</p>
        </div>

        {/* User Account Details & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {user && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-neon), var(--secondary-neon))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#000',
                fontSize: '0.85rem'
              }}>
                {user.name ? user.name[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'C')}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {user.name || user.email}
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(0, 242, 254, 0.15)',
                    color: 'var(--primary-neon)'
                  }}>
                    {user.role || 'Citizen'}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={onBackToHome} 
            className="btn btn-secondary" 
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Go to Homepage without signing out"
          >
            <Home size={15} /> Home
          </button>

          <button 
            onClick={onLogout} 
            className="btn btn-danger" 
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Sign out of your account"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {/* Tab Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          <button 
            onClick={() => setActiveTab('list')} 
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none', boxShadow: activeTab === 'list' ? 'var(--shadow-neon)' : 'none' }}
          >
            <List size={16} /> My Submissions
          </button>
          <button 
            onClick={() => { setActiveTab('report'); resetForm(); }} 
            className={`btn ${activeTab === 'report' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem', border: 'none', boxShadow: activeTab === 'report' ? 'var(--shadow-neon)' : 'none' }}
          >
            <PlusCircle size={16} /> File New Report
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.3)', color: '#ff4d88', padding: '12px 16px', borderRadius: '10px', marginBottom: '24px', fontSize: '0.9rem' }}>
          <strong>Error: </strong>{errorMsg}
        </div>
      )}

      {/* --- TAB 1: LIST MY REPORTS --- */}
      {activeTab === 'list' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '20px' }}>Your Filed Incidents</h2>

          {loadingList ? (
            <div className="flex-row-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '15px' }}>
              <Loader className="pulse-glow" style={{ animation: 'spin 1.5s infinite linear', color: 'var(--primary-neon)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Retrieving submitted reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <HelpCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', marginBottom: '20px' }}>You have not submitted any reports yet.</p>
              <button onClick={() => setActiveTab('report')} className="btn btn-primary">
                File Your First Report <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 8px' }}>Tracking ID</th>
                    <th style={{ padding: '12px 8px' }}>Issue Class</th>
                    <th style={{ padding: '12px 8px' }}>Address</th>
                    <th style={{ padding: '12px 8px' }}>Status</th>
                    <th style={{ padding: '12px 8px' }}>Priority</th>
                    <th style={{ padding: '12px 8px' }}>Submitted</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((rep) => (
                    <tr 
                      key={rep.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-light)', 
                        fontSize: '0.9rem',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 8px', fontWeight: 600, color: 'var(--primary-neon)' }}>
                        <button 
                          onClick={() => handleOpenTracking(rep.id)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--primary-neon)', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            textDecoration: 'underline'
                          }}
                          title="Click to track live authority action progress"
                        >
                          {rep.id.substring(0, 8)}...
                        </button>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{rep.ai_problem}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rep.ai_category}</div>
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rep.address}
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: getStatusColor(rep.status) }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(rep.status) }} />
                          {rep.status || 'Reported'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        {rep.priority_score !== null ? (
                          <span style={{ fontWeight: 700, color: rep.priority_score >= 70 ? 'var(--color-critical)' : '#fff' }}>
                            {rep.priority_score}/100
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(rep.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            onClick={() => handleOpenTracking(rep.id)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.78rem', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '5px',
                              borderColor: 'rgba(0, 242, 254, 0.3)',
                              color: 'var(--primary-neon)',
                              background: 'rgba(0, 242, 254, 0.05)'
                            }}
                            title="View Live Authority Actions, Dispatch Notes, and Resolution Logs"
                          >
                            <Eye size={13} /> View Actions
                          </button>
                          <button 
                            onClick={() => handleDeleteReport(rep.id)} 
                            className="btn btn-danger" 
                            title="Withdraw Report"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: MULTI-STEP REPORT FLOW --- */}
      {activeTab === 'report' && (
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Step Progress indicators */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'var(--border-light)', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: '15px', left: '10%', width: reportStep === 2 ? '40%' : reportStep >= 3 ? '80%' : '0%', height: '2px', background: 'var(--primary-neon)', zIndex: 2, transition: 'width 0.3s' }} />

            <div style={{ zIndex: 3, textAlign: 'center', width: '20%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: reportStep >= 1 ? 'var(--primary-neon)' : 'var(--bg-main)', border: '2px solid var(--primary-neon)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#070913', fontWeight: 700 }}>
                {reportStep > 1 ? <Check size={16} /> : '1'}
              </div>
              <span style={{ fontSize: '0.75rem', color: reportStep >= 1 ? '#fff' : 'var(--text-muted)' }}>Evidence</span>
            </div>

            <div style={{ zIndex: 3, textAlign: 'center', width: '20%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: reportStep >= 2 ? 'var(--primary-neon)' : 'var(--bg-main)', border: '2px solid ' + (reportStep >= 2 ? 'var(--primary-neon)' : 'var(--border-light)'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: reportStep >= 2 ? '#070913' : 'var(--text-muted)', fontWeight: 700 }}>
                {reportStep > 2 ? <Check size={16} /> : '2'}
              </div>
              <span style={{ fontSize: '0.75rem', color: reportStep >= 2 ? '#fff' : 'var(--text-muted)' }}>Location</span>
            </div>

            <div style={{ zIndex: 3, textAlign: 'center', width: '20%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: reportStep >= 3 ? 'var(--primary-neon)' : 'var(--bg-main)', border: '2px solid ' + (reportStep >= 3 ? 'var(--primary-neon)' : 'var(--border-light)'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: reportStep >= 3 ? '#070913' : 'var(--text-muted)', fontWeight: 700 }}>
                {reportStep > 3 ? <Check size={16} /> : '3'}
              </div>
              <span style={{ fontSize: '0.75rem', color: reportStep >= 3 ? '#fff' : 'var(--text-muted)' }}>Review</span>
            </div>

            <div style={{ zIndex: 3, textAlign: 'center', width: '20%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: reportStep >= 4 ? 'var(--primary-neon)' : 'var(--bg-main)', border: '2px solid ' + (reportStep >= 4 ? 'var(--primary-neon)' : 'var(--border-light)'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: reportStep >= 4 ? '#070913' : 'var(--text-muted)', fontWeight: 700 }}>
                {reportStep >= 4 ? <Check size={16} /> : '4'}
              </div>
              <span style={{ fontSize: '0.75rem', color: reportStep >= 4 ? '#fff' : 'var(--text-muted)' }}>Success</span>
            </div>
          </div>

          {/* --- STEP 1: IMAGE CAPTURE / UPLOAD --- */}
          {reportStep === 1 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Step 1: Upload Incident Photo</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Provide visual evidence of the civic issue. Camera capture is supported on mobile devices.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', margin: '30px 0' }}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', maxWidth: '320px', height: '240px', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={() => { setSelectedImage(null); setImagePreview(null); }} 
                      className="btn btn-danger"
                      style={{ position: 'absolute', bottom: '12px', right: '12px', padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Replace Image
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '400px', flexDirection: 'column' }}>
                    {/* Camera Capture Option */}
                    <label className="btn btn-secondary" style={{ padding: '24px', flexDirection: 'column', height: '120px', borderStyle: 'dashed', borderColor: 'var(--primary-neon)' }}>
                      <Camera size={32} className="neon-text" style={{ marginBottom: '8px' }} />
                      <span>Take Photo (Camera)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleImageChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                    
                    {/* Gallery Upload Option */}
                    <label className="btn btn-secondary" style={{ padding: '20px', flexDirection: 'column', height: '100px', borderStyle: 'dashed' }}>
                      <Image size={24} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
                      <span>Choose from Gallery</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                )}

                {/* Description Input */}
                <div style={{ width: '100%', marginTop: '20px' }}>
                  <label className="form-label">Optional Description / Details</label>
                  <textarea 
                    placeholder="Enter details like landmarks, description of damage, or specific safety concerns (e.g. near school gate)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-input"
                    rows="3"
                    style={{ resize: 'none' }}
                  />
                </div>
              </div>

              <div className="flex-row-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '30px' }}>
                <span />
                <button 
                  onClick={() => setReportStep(2)} 
                  disabled={!selectedImage}
                  className="btn btn-primary"
                >
                  Next: Add Location <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* --- STEP 2: LOCATION SELECT --- */}
          {reportStep === 2 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Step 2: Pinpoint Location</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Move the map marker, search, or auto-detect your coordinates inside Delhi/India.</p>
              
              <div style={{ height: '380px', width: '100%', marginBottom: '20px' }}>
                <MapComponent 
                  mode="pick"
                  value={location}
                  onChange={(newLoc) => setLocation(prev => ({ ...prev, ...newLoc }))}
                />
              </div>

              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--primary-neon)', marginBottom: '4px' }}>Selected Coordinates:</div>
                <div style={{ fontFamily: 'monospace' }}>Lat: {location.lat.toFixed(6)} | Lng: {location.lng.toFixed(6)}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '6px' }}>Address: {location.address}</div>
              </div>

              <div className="flex-row-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '30px' }}>
                <button onClick={() => setReportStep(1)} className="btn btn-secondary">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  onClick={handleRunAnalysisAndUpload} 
                  disabled={analyzing}
                  className="btn btn-primary"
                >
                  {analyzing ? (
                    <>
                      <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={16} />
                      Analyzing Issue...
                    </>
                  ) : (
                    <>
                      Run AI Analysis <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* --- STEP 3: REVIEW AI ANALYSIS --- */}
          {reportStep === 3 && aiAnalysis && (
            <div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Step 3: Review AI Diagnosis</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Confirm the Gemini AI structured classification and submit.</p>
              
              <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
                
                {/* Image & Description Block */}
                <div>
                  <div style={{ width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: '12px' }}>
                    <img src={imagePreview} alt="Incident" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <strong>User Notes: </strong>{description || 'No notes provided.'}
                  </div>
                </div>

                {/* AI diagnosis block */}
                <div className="glass-card" style={{ borderColor: 'rgba(0,242,254,0.2)', background: 'rgba(0, 242, 254, 0.02)' }}>
                  <div style={{ color: 'var(--primary-neon)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    🤖 GEMINI MULTIMODAL DIAGNOSIS
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ marginBottom: '4px' }}>Detected Issue</label>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{aiAnalysis.problem}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ marginBottom: '4px' }}>Category</label>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{aiAnalysis.category}</div>
                    </div>
                    <div>
                      <label className="form-label" style={{ marginBottom: '4px' }}>AI Severity</label>
                      <span className={`badge badge-${aiAnalysis.severity.toLowerCase()}`}>
                        {aiAnalysis.severity}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ marginBottom: '4px' }}>Summary</label>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {aiAnalysis.summary}
                    </div>
                  </div>
                </div>

              </div>

              {aiAnalysis.isFallback && (
                <div style={{ background: 'rgba(255,204,0,0.05)', border: '1px solid rgba(255,204,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.8rem', color: 'var(--color-medium)' }}>
                  💡 <strong>Demo Mode Note:</strong> Gemini API Key was unconfigured or inaccessible. Analysis was processed via local heuristic backup engine.
                </div>
              )}

              <div className="flex-row-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '30px' }}>
                <button onClick={() => setReportStep(2)} className="btn btn-secondary">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  onClick={handleSubmitReport} 
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={16} />
                      Submitting Report...
                    </>
                  ) : (
                    <>
                      Submit Report & Calculate Priority <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* --- STEP 4: SUCCESS TRACKING --- */}
          {reportStep === 4 && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 230, 118, 0.1)', color: 'var(--color-low)', border: '2px solid var(--color-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Check size={32} />
              </div>
              
              <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Report Successfully Submitted!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 30px', lineHeight: 1.6 }}>
                CivicPulse has registered the issue. Our duplicate grouping detector and priority score engines have queued this incident for authority action.
              </p>

              <div className="glass-card" style={{ maxWidth: '450px', margin: '0 auto 30px', padding: '20px', borderColor: 'var(--primary-neon)' }}>
                <span className="form-label" style={{ marginBottom: '6px' }}>Your Incident Tracking ID</span>
                <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-neon)', background: 'rgba(0,242,254,0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed rgba(0,242,254,0.3)', letterSpacing: '0.05em' }}>
                  {trackingId}
                </div>
              </div>

              <div className="flex-row-center" style={{ gap: '12px' }}>
                <button onClick={resetForm} className="btn btn-primary">
                  View My Submissions
                </button>
                <button 
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    setDescription('');
                    setLocation({ lat: 28.6139, lng: 77.2295, address: 'Delhi, India' });
                    setAiAnalysis(null);
                    setTrackingId(null);
                    setReportStep(1);
                    setErrorMsg(null);
                  }} 
                  className="btn btn-secondary"
                >
                  File Another Report
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── LIVE INCIDENT TRACKING & AUTHORITY ACTION MODAL ─── */}
      {selectedReportId && (
        <div 
          onClick={() => setSelectedReportId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="glass-card"
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px',
              background: 'var(--bg-main)',
              border: '1px solid rgba(0, 242, 254, 0.35)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 242, 254, 0.15)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-neon)', background: 'rgba(0,242,254,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,242,254,0.2)' }}>
                    TRACKING ID: {selectedReportId}
                  </span>
                  {trackingDetails?.incident?.status && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      background: `${getStatusColor(trackingDetails.incident.status)}22`,
                      color: getStatusColor(trackingDetails.incident.status),
                      border: `1px solid ${getStatusColor(trackingDetails.incident.status)}55`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusColor(trackingDetails.incident.status) }} />
                      {trackingDetails.incident.status}
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0 }}>
                  {trackingDetails?.report?.ai_problem || 'Incident Progress & Authority Actions'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                  📍 {trackingDetails?.report?.address || 'Delhi, India'}
                </p>
              </div>

              <button 
                onClick={() => setSelectedReportId(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 0, 85, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {loadingTracking ? (
              <div className="flex-row-center" style={{ padding: '60px 0', flexDirection: 'column', gap: '15px' }}>
                <Loader className="pulse-glow" style={{ animation: 'spin 1.5s infinite linear', color: 'var(--primary-neon)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading live authority logs & action status...</p>
              </div>
            ) : trackingDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. Visual Progress Stepper Bar */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px 20px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                    Workflow Resolution Stages
                  </h4>

                  {(() => {
                    const stages = [
                      { id: 'Reported', label: 'Reported', desc: 'Citizen registered' },
                      { id: 'AI Analysed', label: 'AI Analysed', desc: 'Severity ranked' },
                      { id: 'Verified', label: 'Verified', desc: 'Admin approved' },
                      { id: 'Dispatched', label: 'Dispatched', desc: 'Worker assigned' },
                      { id: 'In Progress', label: 'In Progress', desc: 'Action on site' },
                      { id: 'Resolved', label: 'Resolved / Closed', desc: 'Proof submitted' }
                    ];

                    const statusOrder = ['Reported', 'AI Analysed', 'Verified', 'Assigned', 'Dispatched', 'In Progress', 'Resolved', 'Closed'];
                    const currentStatus = trackingDetails.incident.status || 'Reported';
                    const currentIndex = statusOrder.indexOf(currentStatus);

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                        {stages.map((stage, idx) => {
                          const stageIndex = statusOrder.indexOf(stage.id === 'Resolved' ? 'Resolved' : stage.id);
                          const isCompleted = currentIndex >= stageIndex;
                          const isCurrent = currentStatus === stage.id || (stage.id === 'Resolved' && (currentStatus === 'Resolved' || currentStatus === 'Closed'));

                          return (
                            <div 
                              key={stage.id} 
                              style={{ 
                                textAlign: 'center', 
                                padding: '10px 6px',
                                borderRadius: '8px',
                                background: isCurrent ? 'rgba(0, 242, 254, 0.1)' : isCompleted ? 'rgba(0, 230, 118, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                                border: isCurrent ? '1px solid var(--primary-neon)' : isCompleted ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid var(--border-light)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: isCompleted ? 'var(--color-low)' : 'rgba(255, 255, 255, 0.1)',
                                color: isCompleted ? '#000' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 8px',
                                fontWeight: 700,
                                fontSize: '0.75rem'
                              }}>
                                {isCompleted ? <Check size={14} /> : idx + 1}
                              </div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isCurrent ? 'var(--primary-neon)' : isCompleted ? '#fff' : 'var(--text-muted)' }}>
                                {stage.label}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {stage.desc}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Authority Dispatch & Field Action Summary Box */}
                <div className="glass-card" style={{ borderColor: 'rgba(155, 81, 224, 0.3)', background: 'rgba(155, 81, 224, 0.03)', padding: '16px 20px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--secondary-neon)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Shield size={16} /> Official Authority Actions & Dispatch
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Field Worker</span>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={15} style={{ color: 'var(--primary-neon)' }} />
                        {trackingDetails.incident.assigned_worker || 'Awaiting Worker Dispatch'}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dispatch Notes / Log</span>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                        {trackingDetails.incident.dispatch_notes || 'No dispatch notes recorded yet.'}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI Computed Priority Score</span>
                      <div style={{ color: 'var(--primary-neon)', fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>
                        {trackingDetails.incident.priority_score}/100 Rank
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Evidence and Resolution Photos Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: trackingDetails.incident.resolution_evidence_url ? '1fr 1fr' : '1fr', gap: '16px' }}>
                  
                  {/* Citizen Original Evidence Photo */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Your Evidence Photo:</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary-neon)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ZoomIn size={12} /> Click to Enlarge
                      </span>
                    </div>

                    <div 
                      onClick={() => setModalImage({
                        url: getImageUrl(trackingDetails.report.image_url),
                        title: 'Your Evidence Photo',
                        subtitle: `Reported on ${new Date(trackingDetails.report.created_at).toLocaleString()}`,
                        description: trackingDetails.report.description || 'No user notes provided.',
                        summary: trackingDetails.report.ai_summary,
                        badge: 'Citizen Evidence'
                      })}
                      style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative' }}
                    >
                      <img 
                        src={getImageUrl(trackingDetails.report.image_url)} 
                        alt="Citizen evidence" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <div style={{ position: 'absolute', bottom: 0, insetInline: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '4px 8px', fontSize: '0.72rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Maximize2 size={12} style={{ color: 'var(--primary-neon)' }} /> View Full Photo
                      </div>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <strong>User Notes:</strong> "{trackingDetails.report.description || 'None'}"
                    </div>
                  </div>

                  {/* Authority Resolution Evidence Proof (if available) */}
                  {trackingDetails.incident.resolution_evidence_url && (
                    <div style={{ background: 'rgba(0, 230, 118, 0.03)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--color-low)' }}>✓ Authority Resolution Proof:</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <ZoomIn size={12} /> Click to Enlarge
                        </span>
                      </div>

                      <div 
                        onClick={() => setModalImage({
                          url: getImageUrl(trackingDetails.incident.resolution_evidence_url),
                          title: 'Official Resolution Proof',
                          subtitle: trackingDetails.incident.assigned_worker ? `Work completed by ${trackingDetails.incident.assigned_worker}` : 'Authority Completion Proof',
                          description: trackingDetails.incident.dispatch_notes || 'Official completion photo uploaded by administrative supervisor.',
                          badge: 'Resolution Proof'
                        })}
                        style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0, 230, 118, 0.4)', cursor: 'pointer', position: 'relative' }}
                      >
                        <img 
                          src={getImageUrl(trackingDetails.incident.resolution_evidence_url)} 
                          alt="Resolution proof" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <div style={{ position: 'absolute', bottom: 0, insetInline: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Verified Resolution Proof
                        </div>
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--color-low)' }}>
                        Status: <strong>Incident Closed & Resolved</strong>
                      </div>
                    </div>
                  )}

                </div>

                {/* 4. Complete Status History & Action Audit Trail */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Clock size={16} /> Complete Status History & Actions Taken
                  </h4>
                  
                  {trackingDetails.history && trackingDetails.history.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '2px solid rgba(0,242,254,0.3)', paddingLeft: '16px', marginLeft: '6px' }}>
                      {trackingDetails.history.map((h) => (
                        <div key={h.id} style={{ position: 'relative', fontSize: '0.82rem' }}>
                          {/* Indicator dot */}
                          <div style={{
                            position: 'absolute',
                            left: '-21px',
                            top: '4px',
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            background: getStatusColor(h.status),
                            boxShadow: `0 0 8px ${getStatusColor(h.status)}`
                          }} />

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                            <strong style={{ color: getStatusColor(h.status) }}>{h.status}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                            Action by: <span style={{ color: '#fff' }}>{h.actor_name}</span>
                          </div>

                          {h.notes && (
                            <div style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', marginTop: '4px', lineHeight: 1.4 }}>
                              "{h.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No status actions recorded yet.</p>
                  )}
                </div>

                <div style={{ textAlign: 'right', marginTop: '10px' }}>
                  <button onClick={() => setSelectedReportId(null)} className="btn btn-secondary" style={{ padding: '8px 20px' }}>
                    Close Window
                  </button>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* ─── Lightbox Image Popup Modal ─── */}
      {modalImage && (
        <div 
          onClick={() => setModalImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="glass-card"
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              background: 'var(--bg-main)',
              border: '1px solid rgba(0, 242, 254, 0.4)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 242, 254, 0.2)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-light)',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: modalImage.badge === 'Resolution Proof' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(0, 242, 254, 0.15)',
                  color: modalImage.badge === 'Resolution Proof' ? 'var(--color-low)' : 'var(--primary-neon)',
                  border: `1px solid ${modalImage.badge === 'Resolution Proof' ? 'rgba(0, 230, 118, 0.3)' : 'rgba(0, 242, 254, 0.3)'}`
                }}>
                  {modalImage.badge}
                </span>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#fff', margin: 0 }}>
                    {modalImage.title}
                  </h3>
                  {modalImage.subtitle && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {modalImage.subtitle}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a 
                  href={modalImage.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ExternalLink size={12} /> Open Tab
                </a>
                <button 
                  onClick={() => setModalImage(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Area */}
            <div style={{
              background: '#070b13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: '55vh',
              overflow: 'hidden',
              padding: '12px'
            }}>
              <img 
                src={modalImage.url} 
                alt="Enlarged" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '52vh',
                  objectFit: 'contain',
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* Modal Details / Meta Info */}
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid var(--border-light)',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: '0.82rem'
            }}>
              {modalImage.description && (
                <div style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: '#fff' }}>Notes:</strong> "{modalImage.description}"
                </div>
              )}
              {modalImage.summary && (
                <div style={{
                  background: 'rgba(0, 242, 254, 0.06)',
                  border: '1px solid rgba(0, 242, 254, 0.2)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: 'var(--primary-neon)',
                  fontSize: '0.78rem',
                  lineHeight: 1.4
                }}>
                  <strong>AI Summary:</strong> {modalImage.summary}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
