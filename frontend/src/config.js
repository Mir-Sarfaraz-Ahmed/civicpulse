// In unified AI Studio deployment, backend and frontend share the same origin (port 3000)
// If frontend is accessed directly via standalone vite port (e.g. 5173), route API to localhost:3000
const getFallbackBackendUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000') {
    return 'http://localhost:3000';
  }
  return '';
};

export const BACKEND_URL = (import.meta.env.VITE_API_URL || getFallbackBackendUrl()).replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

