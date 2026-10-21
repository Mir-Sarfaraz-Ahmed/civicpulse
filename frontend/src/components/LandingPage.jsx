import React from 'react';
import { Eye, Flame, ArrowRight, Zap, BarChart2 } from 'lucide-react';
import { TopographyBackground } from './ui/backgrounds-topography';
import { GlassEffect, GlassFilter } from './ui/liquid-glass';

export default function LandingPage({ onNavigate, user, onLogout }) {
  return (
    <div className="landing-page" style={{ position: 'relative', minHeight: '100vh', paddingBottom: '70px', overflowX: 'hidden' }}>
      
      {/* SVG Liquid Glass Refractive Filter */}
      <GlassFilter />

      {/* Topography Interactive Vector Contour Background */}
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 0, 
          pointerEvents: 'auto',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at center, #071224 0%, #02040a 100%)'
        }}
      >
        <TopographyBackground
          lineColor="rgba(0, 242, 254, 0.45)"
          levels={18}
          speed={0.8}
          scale={1.2}
          peak={1.4}
          interactive={true}
          style={{ width: '100%', height: '100%' }}
        />
        {/* Subtle Vignette for High Text Readability */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 30%, rgba(2, 4, 10, 0.2) 0%, rgba(2, 4, 10, 0.75) 100%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Foreground Content (100% Unchanged) */}
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* 1. Navbar */}
      <header className="navbar">
        <div className="container flex-row-between" style={{ minHeight: '64px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('landing')}>
            <Zap size={22} className="neon-text" />
            <span>Naagrik</span>
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
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          background: 'linear-gradient(135deg, rgba(14, 20, 42, 0.88) 0%, rgba(8, 12, 26, 0.94) 100%)', 
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 242, 254, 0.35)', 
          padding: '7px 20px', 
          borderRadius: '30px', 
          fontSize: '0.78rem', 
          fontWeight: 600, 
          color: 'var(--primary-neon)', 
          letterSpacing: '0.06em', 
          marginBottom: '22px', 
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.2)' 
        }}>
          NEXT-GEN CIVIC INTELLIGENCE PLATFORM
        </div>
        <h1 className="text-gradient" style={{ fontSize: 'clamp(2.2rem, 5.2vw, 3.6rem)', marginBottom: '18px', lineHeight: 1.16, letterSpacing: '-0.025em' }}>
          Governance decisions driven by real-time civic intelligence
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.18rem)', color: 'var(--text-muted)', maxWidth: '780px', margin: '0 auto 34px', lineHeight: 1.65 }}>
          Naagrik aggregates citizen sentiment, public service data, and policy signals — delivering actionable intelligence to India's government bodies, civic planners, and policy researchers.
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
        <div 
          className="glass-card flex-row-center" 
          style={{ 
            padding: '22px 34px', 
            textAlign: 'center', 
            background: 'linear-gradient(135deg, rgba(14, 18, 36, 0.62) 0%, rgba(7, 9, 22, 0.74) 100%)',
            borderColor: 'rgba(155, 81, 224, 0.4)', 
            maxWidth: '980px', 
            margin: '0 auto',
            borderRadius: '20px',
            boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.75), inset 0 1px 1px 0 rgba(255, 255, 255, 0.25), 0 0 32px rgba(155, 81, 224, 0.15)' 
          }}
        >
          <h3 style={{ fontSize: 'clamp(1rem, 2vw, 1.22rem)', fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.55 }}>
            ⚡ <span className="neon-text" style={{ fontWeight: 700 }}>Naagrik</span> converts raw complaints into structured, prioritized, actionable urban intelligence.
          </h3>
        </div>
      </section>

      {/* 4. Core Problems & AI Solutions */}
      <section className="container grid-2" style={{ marginBottom: '72px', gap: '28px' }}>
        <GlassEffect 
          style={{ padding: '30px', height: '100%', borderColor: 'rgba(255, 0, 85, 0.3)' }}
          glowColor="rgba(255, 0, 85, 0.12)"
        >
          <div style={{ background: 'rgba(255, 0, 85, 0.1)', color: 'var(--color-critical)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', border: '1px solid rgba(255, 0, 85, 0.25)' }}>
            <Flame size={24} />
          </div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '14px', fontWeight: 700 }}>The Legacy Problem</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65 }}>
            Traditional complaint forms store unstructured reports in endless queues. They fail to understand what the issue is, ignore physical proximity duplicates, and provide no logical prioritization. As a result, critical safety hazards remain unaddressed for weeks while trivial complaints jam the system.
          </p>
        </GlassEffect>

        <GlassEffect 
          style={{ padding: '30px', height: '100%', borderColor: 'rgba(0, 242, 254, 0.35)' }}
          glowColor="rgba(0, 242, 254, 0.15)"
        >
          <div style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-neon)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
            <Eye size={24} />
          </div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '14px', fontWeight: 700 }}>Intelligence built for civic complexity</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65 }}>
            India's governance operates at a scale that demands more than dashboards. Naagrik turns fragmented public data into structured, decision-ready insight — across every ward, district, and department.
          </p>
        </GlassEffect>
      </section>

      {/* 5. How It Works - Step Workflow */}
      <section className="container" style={{ marginBottom: '72px' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.3rem)', textAlign: 'center', marginBottom: '36px' }} className="text-gradient">
          System Workflow Architecture
        </h2>
        
        <div className="grid-3" style={{ gap: '24px' }}>
          <GlassEffect style={{ padding: '28px 22px', textAlign: 'center', height: '100%' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-neon)', marginBottom: '10px', lineHeight: 1 }}>01</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Citizen Submission</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Upload or snap a photo of the incident, write a description, and select the location on our interactive Delhi map.
            </p>
          </GlassEffect>

          <GlassEffect style={{ padding: '28px 22px', textAlign: 'center', height: '100%', borderColor: 'rgba(155,81,224,0.35)' }} glowColor="rgba(155, 81, 224, 0.15)">
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--secondary-neon)', marginBottom: '10px', lineHeight: 1 }}>02</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Multimodal AI Scan</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              The server sends assets to Gemini AI to extract the issue class, verify severity, and generate structured summaries.
            </p>
          </GlassEffect>

          <GlassEffect style={{ padding: '28px 22px', textAlign: 'center', height: '100%' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-neon)', marginBottom: '10px', lineHeight: 1 }}>03</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', fontWeight: 700 }}>Priority & Grouping</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              The backend groups coordinates within 100 meters, computes the 0–100 priority score, and alerts the admin team.
            </p>
          </GlassEffect>
        </div>
      </section>

      {/* 6. Highlight: Math Priority Engine */}
      <section className="container" style={{ marginBottom: '72px' }}>
        <GlassEffect style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
          <div className="grid-2" style={{ alignItems: 'center', gap: '32px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary-neon)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                <BarChart2 size={16} /> Deterministic Priority Algorithm
              </div>
              <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', marginBottom: '16px', lineHeight: 1.25, fontWeight: 700 }}>
                Priority scores calculated on factors, not guesses
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: '20px' }}>
                Our proprietary scoring system calculates priority based on dynamic factors instead of relying on preset metrics or theoretical guess by qualitative models:
              </p>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: 1.8 }}>
                <li><strong style={{ color: 'var(--text-main)' }}>Base priority</strong>: Assigned based on problem category and detected severity level.</li>
                <li><strong style={{ color: 'var(--text-main)' }}>Vulnerability Multiplier</strong>: Boosts score by 10 points based on proximity to metro stations, hospitals, schools, or highways.</li>
                <li><strong style={{ color: 'var(--text-main)' }}>Cluster report Increments</strong>: Increments in priority as duplicate reports cluster, emphasizing popular concerns.</li>
              </ul>
            </div>
            
            <div className="flex-row-center" style={{ 
              background: 'linear-gradient(135deg, rgba(14, 19, 40, 0.62) 0%, rgba(7, 10, 22, 0.74) 100%)', 
              backdropFilter: 'blur(24px)', 
              WebkitBackdropFilter: 'blur(24px)', 
              border: '1px solid rgba(255, 255, 255, 0.12)', 
              borderRadius: '16px', 
              padding: '32px 24px', 
              flexDirection: 'column', 
              width: '100%',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.18)' 
            }}>
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
        </GlassEffect>
      </section>

      {/* 7. Footer */}
      <footer style={{ borderTop: '1px solid var(--border-light)', paddingTop: '28px', marginTop: '48px' }}>
        <div className="container flex-row-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            &copy; 2026 Naagrik. Developed by <strong>The Predator</strong>.
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <a href="#terms" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Terms</a>
            <a href="#privacy" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Privacy Policy</a>
            <a href="#authority" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} style={{ color: 'var(--primary-neon)', textDecoration: 'none', fontWeight: 600 }}>Authority Login</a>
          </div>
        </div>
      </footer>

      </div>

    </div>
  );
}

