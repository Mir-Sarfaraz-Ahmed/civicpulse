import React, { useState, useEffect } from 'react';
import { Shield, Eye, Flame, MapPin, CheckCircle, ArrowLeft, ArrowRight, Loader, Zap, Key, Mail, User, Info, Database, Truck, Wrench } from 'lucide-react';
import { TruckIcon } from './components/ui/TruckIcon';
import { AdminShieldIcon, AccountIcon } from './components/ui/RoleIcons';
import LandingPage from './components/LandingPage';
import CivilianPortal from './components/CivilianPortal';
import AdminDashboard from './components/AdminDashboard';
import CrewPortal from './components/CrewPortal';
import { supabase } from './supabaseClient';
import { API_BASE } from './config';



export default function App() {
  const [page, setPage] = useState('landing'); // 'landing', 'login', 'register', 'civilian', 'admin', 'crew'
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
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
        const authProvider = localStorage.getItem('civicpulse_auth_provider');
        // Only clear session if user was genuinely signed in via Supabase OAuth
        if (authProvider === 'supabase_oauth') {
          localStorage.removeItem('civicpulse_token');
          localStorage.removeItem('civicpulse_user');
          localStorage.removeItem('civicpulse_auth_provider');
          setToken(null);
          setUser(null);
          setPage((prev) => (prev === 'civilian' || prev === 'admin' || prev === 'crew') ? 'login' : prev);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleNavigate = (targetPage) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmail('');
    setPassword('');
    setName('');
    setPage(targetPage);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Supabase Auth] Sign out note:', e);
    }
    localStorage.removeItem('civicpulse_token');
    localStorage.removeItem('civicpulse_user');
    localStorage.removeItem('civicpulse_auth_provider');
    setToken(null);
    setUser(null);
    setPage('landing');
  };

  const saveAuthSession = (tokenStr, userObj, provider = 'direct') => {
    localStorage.setItem('civicpulse_token', tokenStr);
    localStorage.setItem('civicpulse_user', JSON.stringify(userObj));
    localStorage.setItem('civicpulse_auth_provider', provider);
    setToken(tokenStr);
    setUser(userObj);
  };

  // Known preset role accounts for instant and offline/hosted resilience
  const PRESET_ACCOUNTS = {
    'admin@gmail.com': {
      id: '1ebec6fa-603c-408b-9ec8-128031cf2497',
      email: 'admin@gmail.com',
      name: 'City Municipal Admin',
      role: 'admin',
      passwords: ['31102006', 'admin123', 'password123', 'admin']
    },
    'crew@gmail.com': {
      id: '5e53514c-2558-41b4-a101-dda5b9393470',
      email: 'crew@gmail.com',
      name: 'Rapid Response Dispatch Crew',
      role: 'crew',
      passwords: ['311102006', 'crew123', 'password123', 'crew']
    },
    'citizen@gmail.com': {
      id: 'ba5012bb-fef8-4ca8-aa8d-35b51ef2d815',
      email: 'citizen@gmail.com',
      name: 'Citizen Reporter',
      role: 'civilian',
      passwords: ['31102006', 'citizen123', 'password123', 'citizen']
    }
  };

  // Register with multi-tier fallback (Backend API -> Supabase Auth -> Local Client Persistence)
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    const submittedName = name.trim();
    const registerEmail = email.trim().toLowerCase();

    if (!registerEmail || !password) {
      setErrorMsg('Email and password are required.');
      setLoading(false);
      return;
    }

    // 1. Try Backend API
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, password, name: submittedName })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.token && data.user) {
          saveAuthSession(data.token, data.user, 'backend');
          setPage('civilian');
          setLoading(false);
          return;
        }
      }
    } catch (backendErr) {
      console.warn('[Backend Auth Register Note]:', backendErr.message);
    }

    // 2. Try Supabase Auth in safe try/catch
    try {
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

      if (!authError && authData?.user) {
        const accessToken = authData.session?.access_token || `session_sb_${Date.now()}`;
        const userObj = {
          id: authData.user.id,
          email: authData.user.email,
          name: submittedName || resolveName(authData.user),
          role: 'civilian'
        };
        saveAuthSession(accessToken, userObj, 'supabase');
        setPage('civilian');
        setLoading(false);
        return;
      }
    } catch (sbErr) {
      console.warn('[Supabase Auth Sign Up Note]:', sbErr.message);
    }

    // 3. Resilient Client Registration (Always works on hosted static sites)
    try {
      const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newUser = {
        id: newUserId,
        email: registerEmail,
        name: submittedName || registerEmail.split('@')[0],
        role: 'civilian',
        password
      };
      // Store in browser registered accounts registry
      const existing = JSON.parse(localStorage.getItem('civicpulse_registered_users') || '[]');
      existing.push(newUser);
      localStorage.setItem('civicpulse_registered_users', JSON.stringify(existing));

      const fallbackToken = `token_reg_${Date.now()}`;
      saveAuthSession(fallbackToken, { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }, 'local');
      setPage('civilian');
    } catch (err) {
      setErrorMsg('Registration failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Login with multi-tier fallback (Backend -> Preset Accounts -> Supabase -> Local Registry)
  const handleLogin = async (e, customEmail, customPassword) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    let loginEmail = (customEmail || email).trim().toLowerCase();
    const loginPassword = customPassword || password;

    if (loginEmail === 'admin' || loginEmail === 'administrator') loginEmail = 'admin@gmail.com';
    if (loginEmail === 'crew' || loginEmail === 'dispatch') loginEmail = 'crew@gmail.com';
    if (loginEmail === 'citizen' || loginEmail === 'civilian') loginEmail = 'citizen@gmail.com';

    if (!loginEmail || !loginPassword) {
      setErrorMsg('Email and password are required.');
      setLoading(false);
      return;
    }

    // 1. Primary auth: Backend database API (Node.js + SQLite)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      }).catch(async () => {
        return await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword })
        });
      });

      const contentType = response?.headers?.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok && data.token && data.user) {
          saveAuthSession(data.token, data.user, 'backend');
          navigateToRolePortal(data.user.role);
          setLoading(false);
          return;
        }
      }
    } catch (backendErr) {
      console.warn('[Backend Auth Note]:', backendErr.message);
    }

    // 2. Secondary auth: Preset role accounts (Immediate zero-delay authentication on hosted apps)
    const preset = PRESET_ACCOUNTS[loginEmail];
    if (preset && preset.passwords.includes(loginPassword)) {
      const sessionToken = `session_preset_${Date.now()}`;
      const userObj = { id: preset.id, email: preset.email, name: preset.name, role: preset.role };
      saveAuthSession(sessionToken, userObj, 'preset');
      navigateToRolePortal(preset.role);
      setLoading(false);
      return;
    }

    // 3. Tertiary auth: Client-side registered users on hosted deployment
    try {
      const registeredUsers = JSON.parse(localStorage.getItem('civicpulse_registered_users') || '[]');
      const matched = registeredUsers.find(u => u.email === loginEmail && u.password === loginPassword);
      if (matched) {
        const sessionToken = `session_local_${Date.now()}`;
        const userObj = { id: matched.id, email: matched.email, name: matched.name, role: matched.role };
        saveAuthSession(sessionToken, userObj, 'local');
        navigateToRolePortal(matched.role);
        setLoading(false);
        return;
      }
    } catch (e) {}

    // 4. Quaternary fallback: Supabase Auth
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
        
        saveAuthSession(authData.session.access_token, userObj, 'supabase');
        navigateToRolePortal(role);
        setLoading(false);
        return;
      }
    } catch (supabaseErr) {
      console.warn('[Supabase Auth Login Note]:', supabaseErr.message);
    }

    setErrorMsg('Invalid email or password. You can click a 1-Click Role Login below to sign in instantly.');
    setLoading(false);
  };



  // Quick 1-Click Role Login helper: sets visual fields and authenticates instantly
  const handleQuickLogin = async (presetEmail, presetPass) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMsg(null);
    setLoading(true);

    const preset = PRESET_ACCOUNTS[presetEmail.toLowerCase()];

    // 1. Try Backend API first
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presetEmail, password: presetPass })
      }).catch(async () => {
        return await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: presetEmail, password: presetPass })
        });
      });

      const contentType = response?.headers?.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok && data.token && data.user) {
          saveAuthSession(data.token, data.user, 'backend');
          navigateToRolePortal(data.user.role);
          setLoading(false);
          return;
        }
      }
    } catch (backendErr) {
      console.warn('[QuickLogin Backend Note]:', backendErr.message);
    }

    // 2. Guaranteed instant fallback for 1-Click Preset Roles (Ensures 100% success on hosted webapps)
    if (preset) {
      const sessionToken = `session_preset_${Date.now()}`;
      const userObj = { id: preset.id, email: preset.email, name: preset.name, role: preset.role };
      saveAuthSession(sessionToken, userObj, 'preset');
      navigateToRolePortal(preset.role);
      setLoading(false);
      return;
    }

    setErrorMsg('Failed to authenticate preset account.');
    setLoading(false);
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
                {page === 'login' ? 'Access Naagrik' : 'Create Citizen Account'}
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



            <form 
              onSubmit={page === 'login' ? (e) => handleLogin(e) : handleRegister} 
              autoComplete="off"
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              {page === 'register' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter your name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="form-input" 
                    autoComplete="off"
                    required 
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  name="civic_user_email"
                  placeholder="name@domain.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="form-input" 
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  name="civic_user_password"
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="form-input" 
                  autoComplete="new-password"
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
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(0, 242, 254, 0.3)', color: 'var(--primary-neon)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <AdminShieldIcon size={14} /> Admin
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleQuickLogin('crew@gmail.com', '31102006')}
                    className="btn btn-secondary"
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(255, 170, 0, 0.3)', color: 'var(--color-medium)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <TruckIcon size={14} /> Crew
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleQuickLogin('citizen@gmail.com', '31102006')}
                    className="btn btn-secondary"
                    style={{ padding: '6px 4px', fontSize: '0.72rem', borderColor: 'rgba(0, 230, 118, 0.3)', color: 'var(--color-low)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <AccountIcon size={14} /> Citizen
                  </button>
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

            {/* Demo Data Helper Controls Box */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--primary-neon)', fontWeight: 600, marginBottom: '8px' }}>
                <Database size={14} /> Demo Data
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
