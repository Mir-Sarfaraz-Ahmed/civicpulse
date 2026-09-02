// Centralized configuration for CivicPulse AI Frontend
// In unified AI Studio deployment, backend and frontend share the same origin
export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

