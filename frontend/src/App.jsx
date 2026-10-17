import React, { useState, useEffect } from 'react';
import { Shield, Eye, Flame, MapPin, CheckCircle, ArrowLeft, ArrowRight, Loader, Zap, Key, Mail, User, Info, Database, Truck, Wrench } from 'lucide-react';
import LandingPage from './components/LandingPage';
import CivilianPortal from './components/CivilianPortal';
import AdminDashboard from './components/AdminDashboard';
import CrewPortal from './components/CrewPortal';
import { supabase } from './supabaseClient';
import { API_BASE } from './config';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState('landing'); // 'landing', 'login', 'register', 'civilian', 'admin', 'crew'
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [clearingLoading, setClearingLoading] = useState(false);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Fetch actual assigned role from Supabase user metadata or public.profiles
  const fetchUserRole = async (supabaseUser) => {
    if (!supabaseUser) return 'civilian';
    if (supabaseUser.user_metadata?.role) {
      return supabaseUser.user_metadata.role;
    }
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', supabaseUser.id)
        .single();
      if (profile && profile.role) {
        return profile.role;
      }
    } catch (err) {
      console.warn('[Supabase Profiles] Could not load user role from table:', err);
    }

    const email = (supabaseUser.email || '').toLowerCase();
    if (email.includes('admin')) return 'admin';
    if (email.includes('crew')) return 'crew';
    return 'civilian';
  };

  const resolveName = (supabaseUser) => {
    if (!supabaseUser) return 'Citizen';
    const metaName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name;
    if (metaName && metaName.trim() && !metaName.includes('@')) {
      return metaName.trim();
    }
    // Check locally saved name cache for this account
    try {
      const cached = localStorage.getItem(`civicpulse_name_${supabaseUser.id}`) || localStorage.getItem(`civicpulse_name_${supabaseUser.email}`);
      if (cached && cached.trim()) return cached.trim();
    } catch (e) {}

    const emailPrefix = (supabaseUser.email || '').split('@')[0] || '';
    if (emailPrefix) {
      const cleaned = emailPrefix.replace(/[._-]/g, ' ').replace(/\d+/g, '').replace(/pw$/i, '').trim();
      if (cleaned.length > 2) {
        return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      return emailPrefix;
    }
    return 'Citizen';
  };

  const resolveAvatar = (supabaseUser) => {
    if (!supabaseUser) return null;
    return supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null;
  };

  const navigateToRolePortal = (role) => {
    if (role === 'admin') setPage('admin');
    else if (role === 'crew') setPage('crew');
    else setPage('civilian');
  };

  // Verify Supabase session on load — listen to auth state changes
  useEffect(() => {
    // 1. Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const isOAuthRedirect = window.location.hash.includes('access_token') || window.location.search.includes('code=');
      if (session?.user) {
        const role = await fetchUserRole(session.user);
        const displayName = resolveName(session.user);
        const avatar = resolveAvatar(session.user);
        setToken(session.access_token);
        const userObj = { id: session.user.id, email: session.user.email, name: displayName, role, avatar };
        setUser(userObj);
        saveAuthSession(session.access_token, userObj);

        if (isOAuthRedirect) {
          window.history.replaceState(null, '', window.location.pathname);
          navigateToRolePortal(role);
        }
      } else {
        const storedToken = localStorage.getItem('civicpulse_token');
        const storedUser = localStorage.getItem('civicpulse_user');
        if (storedToken && storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setToken(storedToken);
            setUser(parsed);
            return;
          } catch (e) {}
        }
        setToken(null);
        setUser(null);
      }
    });

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const role = await fetchUserRole(session.user);
        const displayName = resolveName(session.user);
        const avatar = resolveAvatar(session.user);
        setToken(session.access_token);
        const userObj = { id: session.user.id, email: session.user.email, name: displayName, role, avatar };
        setUser(userObj);
        saveAuthSession(session.access_token, userObj);

        if (event === 'SIGNED_IN') {
          const isOAuthRedirect = window.location.hash.includes('access_token') || window.location.search.includes('code=');
          if (isOAuthRedirect) {
            window.history.replaceState(null, '', window.location.pathname);
            navigateToRolePortal(role);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('civicpulse_token');
        localStorage.removeItem('civicpulse_user');
        setToken(null);
        setUser(null);
        setPage((prev) => (prev === 'civilian' || prev === 'admin' || prev === 'crew') ? 'login' : prev);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleNavigate = (targetPage, options = {}) => {
    setErrorMsg(null);
    if (!options.keepSuccess) setSuccessMsg(null);
    setPage(targetPage);
    
    if (targetPage === 'login') {
      if (!options.keepEmail) {
        setEmail('');
        setPassword('');
      } else {
        setPassword('');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Supabase Auth] Sign out error:', e);
    }
    localStorage.removeItem('civicpulse_token');
    localStorage.removeItem('civicpulse_user');
    setToken(null);
    setUser(null);
    setPage('landing');
  };

  const saveAuthSession = (tokenStr, userObj) => {
    localStorage.setItem('civicpulse_token', tokenStr);
    localStorage.setItem('civicpulse_user', JSON.stringify(userObj));
    setToken(tokenStr);
    setUser(userObj);
  };

  // Register with Supabase Auth — creates citizen account
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    const submittedName = name.trim();
    const registerEmail = email.trim();

    try {
      // 1. Supabase Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerEmail,
        password: password,
        options: {
          data: {
            name: submittedName,
            role: 'civilian'
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (authData?.user) {
        const accessToken = authData.session?.access_token || `session_${Date.now()}`;
        const userObj = {
          id: authData.user.id,
          email: authData.user.email,
          name: submittedName || resolveName(authData.user),
          role: 'civilian'
        };

        saveAuthSession(accessToken, userObj);

        // Also notify backend registration
        try {
          await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: registerEmail, password, name: submittedName })
          });
        } catch (e) {}

        setPage('civilian');
        return;
      }
    } catch (err) {
      console.warn('[Supabase Auth Register Note, attempting Backend sync]:', err.message);
      // Fallback: Backend registration if Supabase had confirmation requirement
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: registerEmail, password, name: submittedName })
        });
        const data = await res.json();
        
        if (res.ok && data.token && data.user) {
          saveAuthSession(data.token, data.user);
          setPage('civilian');
          return;
        } else {
          setErrorMsg(err.message || data.error || 'Registration failed.');
        }
      } catch (fallbackErr) {
        setErrorMsg(err.message || 'Registration failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Login via Supabase Auth with backend fallback
  const handleLogin = async (e, customEmail, customPassword) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const loginEmail = (customEmail || email).trim();
    const loginPassword = customPassword || password;

    if (!loginEmail || !loginPassword) {
      setErrorMsg('Email and password are required.');
      setLoading(false);
      return;
    }

    // 1. Try Supabase Auth First
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (!authError && authData?.session) {
        const sessionUser = authData.session.user;
        const role = await fetchUserRole(sessionUser);
        const displayName = resolveName(sessionUser);
        const userObj = { id: sessionUser.id, email: sessionUser.email, name: displayName, role };
        
        saveAuthSession(authData.session.access_token, userObj);
        
        if (role === 'admin') setPage('admin');
        else if (role === 'crew') setPage('crew');
        else setPage('civilian');
        
        setLoading(false);
        return;
      }
    } catch (supabaseErr) {
      console.warn('[Supabase Auth Login Note]', supabaseErr.message);
    }

    // 2. Primary fallback: Backend authentication (seeded demo accounts)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok && data.token && data.user) {
        saveAuthSession(data.token, data.user);
        if (data.user.role === 'admin') {
          setPage('admin');
        } else if (data.user.role === 'crew') {
          setPage('crew');
        } else {
          setPage('civilian');
        }
        setLoading(false);
        return;
      } else if (data && data.error) {
        setErrorMsg(data.error);
        setLoading(false);
        return;
      }
    } catch (backendErr) {
      console.warn('[Backend Auth Network Error]', backendErr);
    }

    setErrorMsg('Invalid email or password. Use demo password: 31102006 or click a 1-Click Role Login below.');
    setLoading(false);
  };

  // Google OAuth Sign In via Supabase
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('[Google OAuth Error]:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google.');
      setGoogleLoading(false);
    }
  };

  // Quick preset login helper
  const handleQuickLogin = (presetEmail, presetPass) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    handleLogin(null, presetEmail, presetPass);
  };

  // Seed Demo Data directly from Login/Landing pages
  const handleTriggerSeeding = async () => {
    setSeedingLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`${API_BASE}/demo/seed`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Demo database seeded successfully with all lifecycle stages!');
        setEmail('admin@gmail.com');
        setPassword('31102006');
      } else {
        setErrorMsg(data.error || 'Seeding failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error executing seeder.');
    } finally {
      setSeedingLoading(false);
    }
  };

  // Clear Demo Data
  const handleTriggerClear = async () => {
    setClearingLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`${API_BASE}/demo/clear`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Demo database cleared successfully! All incidents removed.');
        setEmail('');
        setPassword('');
      } else {
        setErrorMsg(data.error || 'Clearing failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error executing clear.');
    } finally {
      setClearingLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Root Router Page Switch */}
      {page === 'landing' && (
        <LandingPage 
          user={user} 
          onNavigate={handleNavigate} 
          onLogout={handleLogout} 
        />
      )}

      {page === 'civilian' && token && (
        <CivilianPortal 
          token={token} 
          user={user}
          onLogout={handleLogout}
          onBackToHome={() => setPage('landing')} 
        />
      )}

      {page === 'admin' && token && (
        <AdminDashboard 
          token={token} 
          user={user}
          onLogout={handleLogout}
          onBackToHome={() => setPage('landing')} 
        />
      )}

      {page === 'crew' && token && (
        <CrewPortal 
          token={token} 
          user={user}
          onLogout={handleLogout}
          onBackToHome={() => setPage('landing')} 
        />
      )}

      {/* Auth Pages (Login & Register) */}
      {(page === 'login' || page === 'register') && (
        <div className="flex-row-center" style={{ flexGrow: 1, padding: '40px 20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px' }}>
            
            {/* Form Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <Zap size={32} className="neon-text" style={{ marginBottom: '10px' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                {page === 'login' ? 'Access CivicPulse AI' : 'Create Citizen Account'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {page === 'login' ? 'Login to file reports, dispatch crews, or manage incidents' : 'Register to report local civic problems'}
              </p>
            </div>

            {errorMsg && (
              <div style={{ color: '#ff4d88', background: 'rgba(255,0,85,0.05)', border: '1px solid rgba(255,0,85,0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                ⚠️ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ color: 'var(--color-low)', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                ✓ {successMsg}
              </div>
            )}

            {/* Google OAuth One-Click Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="btn btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '11px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: '#fff',
                borderRadius: '8px',
                cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '16px'
              }}
            >
              {googleLoading ? (
                <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={18} />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <span>{page === 'login' ? 'Continue with Google' : 'Sign up with Google'}</span>
                </>
              )}
            </button>

            {/* Visual Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
              <span style={{ padding: '0 12px' }}>or continue with email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            </div>

            <form onSubmit={page === 'login' ? (e) => handleLogin(e) : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {page === 'register' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter your name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="form-input" 
                    required 
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@domain.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="form-input" 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="form-input" 
                  required 
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                {loading ? <Loader style={{ animation: 'spin 1.5s infinite linear' }} size={16} /> : (page === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            {/* QUICK ROLE LOGIN DEMO SHORTCUTS */}
            {page === 'login' && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  Quick 1-Click Role Logins:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button 
                    type="button" 
                    onClick={() => handleQuickLogin('admin@gmail.com', '31102006')}
                    className="btn btn-secondary"
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(0, 242, 254, 0.3)', whiteSpace: 'nowrap' }}
                  >
                    🛡️ Admin
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleQuickLogin('crew@gmail.com', '31102006')}
                    className="btn btn-secondary"
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(255, 170, 0, 0.3)', color: 'var(--color-medium)', whiteSpace: 'nowrap' }}
                  >
                    🚛 Crew
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleQuickLogin('citizen@gmail.com', '31102006')}
                    className="btn btn-secondary"
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(0, 230, 118, 0.3)', color: 'var(--color-low)', whiteSpace: 'nowrap' }}
                  >
                    👤 Citizen
                  </button>
                </div>
                <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Password for all roles: <code style={{ color: 'var(--primary-neon)', background: 'rgba(0,242,254,0.1)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(0,242,254,0.25)', fontWeight: 600 }}>31102006</code>
                </div>
              </div>
            )}

            {/* Toggle Login/Register */}
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {page === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <a href="#" onClick={() => handleNavigate('register')} style={{ color: 'var(--primary-neon)', textDecoration: 'none', fontWeight: 600 }}>
                    Register
                  </a>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <a href="#" onClick={() => handleNavigate('login')} style={{ color: 'var(--primary-neon)', textDecoration: 'none', fontWeight: 600 }}>
                    Sign In
                  </a>
                </>
              )}
            </div>

            {/* Hackathon Judging Helper Controls Box */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--primary-neon)', fontWeight: 600, marginBottom: '8px' }}>
                <Database size={14} /> Hackathon Seed & Reset
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleTriggerSeeding} 
                  disabled={seedingLoading || clearingLoading}
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'rgba(0, 242, 254, 0.2)', whiteSpace: 'nowrap' }}
                >
                  {seedingLoading ? 'Seeding...' : 'Seed All States'}
                </button>
                <button 
                  type="button" 
                  onClick={handleTriggerClear} 
                  disabled={seedingLoading || clearingLoading}
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(255, 0, 85, 0.05)', borderColor: 'rgba(255, 0, 85, 0.2)', color: '#ff4d88', whiteSpace: 'nowrap' }}
                >
                  {clearingLoading ? 'Clearing...' : 'Clear DB'}
                </button>
              </div>
            </div>

            <button onClick={() => setPage('landing')} className="btn btn-secondary" style={{ width: '100%', marginTop: '14px', padding: '8px', fontSize: '0.8rem' }}>
              Back to Homepage
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
