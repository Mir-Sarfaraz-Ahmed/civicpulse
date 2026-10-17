import React from 'react';
import { Eye, Flame, ArrowRight, Zap, BarChart2 } from 'lucide-react';

export default function LandingPage({ onNavigate, user, onLogout }) {
  return (
    <div className="landing-page" style={{ paddingBottom: '70px' }}>
      
      {/* 1. Navbar */}
      <header className="navbar">
        <div className="container flex-row-between" style={{ minHeight: '64px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('landing')}>
            <Zap size={22} className="neon-text" />
            <span>Civic<span className="neon-text">Pulse</span> <span style={{ fontSize: '0.75rem', verticalAlign: 'super', background: 'rgba(0,242,254,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary-neon)', border: '1px solid rgba(0,242,254,0.2)' }}>AI</span></span>
          </div>
          
          <nav className="nav-links">
            {user ? (
              <>
                <span className="hide-mobile" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {user.avatar && (
                    <img 
                      src={user.avatar} 
                      alt={user.name || 'User'} 
                      referrerPolicy="no-referrer"
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--primary-neon)' }}
                    />
                  )}
                  <span>Logged in as <strong style={{ color: '#fff' }}>{user.name}</strong> ({user.role})</span>
                </span>
                
                {user.role === 'civilian' ? (
                  <button onClick={() => onNavigate('civilian')} className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                    My Portal
                  </button>
                ) : user.role === 'crew' ? (
                  <button onClick={() => onNavigate('crew')} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                    Crew Tasks
                  </button>
                ) : (
                  <button onClick={() => onNavigate('admin')} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                    Dashboard
                  </button>
                )}

                <button onClick={onLogout} className="btn btn-danger" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button onClick={() => onNavigate('login')} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                  Sign In
                </button>
                <button onClick={() => onNavigate('register')} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', boxShadow: 'none' }}>
                  Register
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="hero container">
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.3)', padding: '6px 16px', borderRadius: '30px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary-neon)', letterSpacing: '0.06em', marginBottom: '22px', whiteSpace: 'nowrap' }}>
          NEXT-GEN CIVIC INTELLIGENCE PLATFORM
        </div>
        <h1 className="text-gradient" style={{ fontSize: 'clamp(2.2rem, 5.2vw, 3.6rem)', marginBottom: '18px', lineHeight: 1.16, letterSpacing: '-0.025em' }}>
          AI-Powered Urban Intelligence <br className="hide-mobile" />& Civic Response
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.18rem)', color: 'var(--text-muted)', maxWidth: '720px', margin: '0 auto 34px', lineHeight: 1.65 }}>
          Citizens report problems. AI analyzes and classifies the severity. CivicPulse priority engines compute response rankings, allowing authorities to act efficiently.
        </p>
        
        <div className="hero-cta-group">
          {user && user.role === 'admin' ? (
            <button onClick={() => onNavigate('admin')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '0.96rem' }}>
              Access Admin Console <ArrowRight size={18} style={{ flexShrink: 0 }} />
            </button>
          ) : user && user.role === 'crew' ? (
            <button onClick={() => onNavigate('crew')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '0.96rem' }}>
              Access Crew Tasks <ArrowRight size={18} style={{ flexShrink: 0 }} />
            </button>
          ) : (
            <button onClick={() => onNavigate(user ? 'civilian' : 'login')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '0.96rem' }}>
              Report a Civic Issue <ArrowRight size={18} style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      </section>

      {/* 3. Core Value Proposition Banner */}
      <section className="container" style={{ marginTop: '28px', marginBottom: '64px' }}>
        <div className="glass-card flex-row-center" style={{ padding: '22px 32px', textAlign: 'center', borderColor: 'rgba(155, 81, 224, 0.25)', maxWidth: '980px', margin: '0 auto' }}>
          <h3 style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.55 }}>
            ⚡ <span className="neon-text" style={{ fontWeight: 700 }}>CivicPulse AI</span> converts raw complaints into structured, prioritized, actionable urban intelligence.
          </h3>
        </div>
      </section>

      {/* 4. Core Problems & AI Solutions */}
      <section className="container grid-2" style={{ marginBottom: '72px', gap: '28px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%' }}>
          <div style={{ background: 'rgba(255, 0, 85, 0.1)', color: 'var(--color-critical)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', border: '1px solid rgba(255, 0, 85, 0.25)' }}>
            <Flame size={24} />
          </div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '14px', fontWeight: 700 }}>The Legacy Problem</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65 }}>
            Traditional complaint forms store unstructured reports in endless queues. They fail to understand what the issue is, ignore physical proximity duplicates, and provide no logical prioritization. As a result, critical safety hazards remain unaddressed for weeks while trivial complaints jam the system.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%', borderColor: 'rgba(0, 242, 254, 0.25)' }}>
          <div style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-neon)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
            <Eye size={24} />
          </div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '14px', fontWeight: 700 }}>The CivicPulse Solution</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65 }}>
            CivicPulse feeds photos and descriptions directly into an AI model for category and severity detection. A mathematical engine calculates a priority score (0–100) based on location risks, while a spatial clustering algorithm automatically groups multiple citizen reports into a single, unified civic incident.
          </p>
        </div>
      </section>

      {/* 5. How It Works - Step Workflow */}
      <section className="container" style={{ marginBottom: '72px' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.3rem)', textAlign: 'center', marginBottom: '36px' }} className="text-gradient">
          System Workflow Architecture
        </h2>
        
        <div className="grid-3" style={{ gap: '24px' }}>
          <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-neon)', marginBottom: '10px', lineHeight: 1 }}>01</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Citizen Submission</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Upload or snap a photo of the incident, write a description, and select the location on our interactive Delhi map.
            </p>
          </div>

          <div className="glass-card" style={{ textAlign: 'center', borderColor: 'rgba(155,81,224,0.25)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--secondary-neon)', marginBottom: '10px', lineHeight: 1 }}>02</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Multimodal AI Scan</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              The server sends assets to Gemini AI to extract the issue class, verify severity, and generate structured summaries.
            </p>
          </div>

          <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-neon)', marginBottom: '10px', lineHeight: 1 }}>03</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Priority & Grouping</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              The backend groups coordinates within 100 meters, computes the 0–100 priority score, and alerts the admin team.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Highlight: Math Priority Engine */}
      <section className="container" style={{ marginBottom: '72px' }}>
        <div className="glass-card grid-2" style={{ alignItems: 'center', padding: 'clamp(24px, 4vw, 40px)', gap: '32px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary-neon)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
              <BarChart2 size={16} /> Deterministic Priority Algorithm
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', marginBottom: '16px', lineHeight: 1.25, fontWeight: 700 }}>
              Priority scores calculated on factors, not guesses
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: '20px' }}>
              Our proprietary scoring system calculates priority scores dynamically using structured metrics rather than qualitative models:
            </p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: 1.8 }}>
              <li><strong style={{ color: 'var(--text-main)' }}>Base Weights</strong>: Assigned by problem category and detected severity level.</li>
              <li><strong style={{ color: 'var(--text-main)' }}>Vulnerability Multiplier</strong>: Boosts score by 10 points if near metro stations, hospitals, schools, or highways.</li>
              <li><strong style={{ color: 'var(--text-main)' }}>Citizen Count Bonus</strong>: Increments priority as duplicate reports cluster, emphasizing popular concerns.</li>
            </ul>
          </div>
          
          <div className="flex-row-center" style={{ background: 'rgba(10,15,30,0.65)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '32px 24px', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="badge badge-critical" style={{ whiteSpace: 'nowrap' }}>Critical Severity (50)</span>
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>+</span>
              <span className="badge badge-low" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-neon)', border: '1px solid rgba(0, 242, 254, 0.3)', whiteSpace: 'nowrap' }}>Road Infra (25)</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '8px', textAlign: 'center' }}>Proximity: School (+10) | Duplicates: 3 (+10)</div>
            <div className="priority-circle text-gradient pulse-glow" style={{ width: '110px', height: '110px', fontSize: '2.4rem', border: '2px solid var(--primary-neon)', boxShadow: '0 0 25px rgba(0, 242, 254, 0.25)', margin: '14px 0' }}>
              95
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#ffffff', letterSpacing: '0.02em' }}>Civic Priority Score</div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={{ borderTop: '1px solid var(--border-light)', paddingTop: '28px', marginTop: '48px' }}>
        <div className="container flex-row-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            &copy; 2026 CivicPulse AI. Developed by <strong>the Predators</strong>.
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <a href="#terms" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Terms</a>
            <a href="#privacy" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Privacy Policy</a>
            <a href="#authority" onClick={(e) => { e.preventDefault(); onNavigate('login', { defaultAdmin: true }); }} style={{ color: 'var(--primary-neon)', textDecoration: 'none', fontWeight: 600 }}>Authority Login</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

