import React, { useState, useEffect } from 'react';
import { Shield, Eye, Flame, MapPin, CheckCircle, ArrowLeft, ArrowRight, Loader, Zap, Key, Mail, User, Info, Database, Truck, Wrench } from 'lucide-react';
import LandingPage from './components/LandingPage';
import CivilianPortal from './components/CivilianPortal';
import AdminDashboard from './components/AdminDashboard';
import CrewPortal from './components/CrewPortal';
import { auth, db } from './firebaseClient';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  // Fetch actual assigned role from Firestore profile
  const fetchUserRole = async (firebaseUser) => {
    if (!firebaseUser) return 'civilian';
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data()?.role) {
        return userDoc.data().role;
      }
    } catch (err) {
      console.warn('[Firestore] Could not load user role from doc:', err);
    }
    return 'civilian';
  };

  const resolveName = (firebaseUser) => {
    if (!firebaseUser) return 'Citizen';
    const metaName = firebaseUser.displayName;
    if (metaName && metaName.trim() && !metaName.includes('@')) {
      return metaName.trim();
    }
    // Check locally saved name cache for this account
    try {
      const cached = localStorage.getItem(`civicpulse_name_${firebaseUser.uid}`) || localStorage.getItem(`civicpulse_name_${firebaseUser.email}`);
      if (cached && cached.trim()) return cached.trim();
    } catch (e) {}

    const emailPrefix = (firebaseUser.email || '').split('@')[0] || '';
    if (emailPrefix) {
      const cleaned = emailPrefix.replace(/[._-]/g, ' ').replace(/\d+/g, '').replace(/pw$/i, '').trim();
      if (cleaned.length > 2) {
        return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      return emailPrefix;
    }
    return 'Citizen';
  };

  // Verify Firebase session on load — protect private pages
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          const role = await fetchUserRole(currentUser);
          const displayName = resolveName(currentUser);
          setToken(idToken);
          setUser({ id: currentUser.uid, email: currentUser.email, name: displayName, role });
        } catch (err) {
          console.error('[Firebase Auth] Failed to get token:', err);
        }
      } else {
        // Check if there's a backend token in localStorage
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

        // No active session — clear any stale local data
        localStorage.removeItem('civicpulse_token');
        localStorage.removeItem('civicpulse_user');
        setToken(null);
        setUser(null);
        setPage((prev) => (prev === 'civilian' || prev === 'admin' || prev === 'crew') ? 'login' : prev);
      }
    });

    return () => unsubscribe();
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
      await signOut(auth);
    } catch (e) {
      console.error('[Firebase Auth] Sign out error:', e);
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

  // Standard Email + Password Register — All new self-registered users are citizens
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    const submittedName = name.trim();
    const registerEmail = email.trim();

    try {
      // 1. Register with backend
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, password, name: submittedName })
      });
      const data = await res.json();
      
      if (res.ok && data.token && data.user) {
        saveAuthSession(data.token, data.user);
        
        // Optional: try to sync to Firestore users collection
        try {
          await setDoc(doc(db, 'users', data.user.id), {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: 'civilian',
            created_at: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('[Firestore] Could not write user doc on register:', dbErr.message);
        }

        setPage('civilian');
        return;
      } else {
        setErrorMsg(data.error || 'Registration failed.');
      }
    } catch (err) {
      console.warn('[Register] Backend registration failed, attempting Firebase Auth fallback:', err);
      // Fallback: Firebase Auth if backend is offline
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, password);
        const createdUser = userCredential.user;

        if (submittedName) {
          await updateProfile(createdUser, { displayName: submittedName });
        }

        const idToken = await createdUser.getIdToken();
        const displayName = submittedName || resolveName(createdUser);
        saveAuthSession(idToken, { id: createdUser.uid, email: createdUser.email, name: displayName, role: 'civilian' });
        setPage('civilian');
      } catch (authErr) {
        console.error('[Registration Error]', authErr);
        if (authErr.code === 'auth/email-already-in-use') {
          setErrorMsg('Email address is already registered.');
        } else if (authErr.code === 'auth/weak-password') {
          setErrorMsg('Password must be at least 6 characters.');
        } else if (authErr.code === 'auth/invalid-email') {
          setErrorMsg('Invalid email address.');
        } else {
          setErrorMsg('Registration failed. Please check your credentials.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Standard Email + Password Login (Civilian, Admin, or Crew)
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

    let backendSuccess = false;

    // 1. Primary auth: Backend database (handles all roles: admin, crew, civilian)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok && data.token && data.user) {
        backendSuccess = true;
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
        // Backend actively validated and rejected the credentials
        setErrorMsg(data.error);
        setLoading(false);
        return;
      }
    } catch (backendErr) {
      console.warn('[Backend Auth Network Error, checking Firebase Auth fallback]', backendErr);
    }

    // 2. Secondary fallback: Firebase Auth (only if backend was unreachable)
    if (!backendSuccess) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        const sessionUser = userCredential.user;
        const idToken = await sessionUser.getIdToken();
        const role = await fetchUserRole(sessionUser);
        const displayName = resolveName(sessionUser);
        saveAuthSession(idToken, { id: sessionUser.uid, email: sessionUser.email, name: displayName, role });
        if (role === 'admin') {
          setPage('admin');
        } else if (role === 'crew') {
          setPage('crew');
        } else {
          setPage('civilian');
        }
      } catch (authErr) {
        console.warn('[Firebase Auth Fallback Notice]', authErr.code || authErr.message);
        setErrorMsg('Invalid email or password.');
      } finally {
        setLoading(false);
      }
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
                    onClick={() => handleQuickLogin('crew@gmail.com', '311102006')}
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
