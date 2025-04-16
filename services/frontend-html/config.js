// This file will be loaded before auth.js and app.js
// It sets configuration variables that would normally come from environment variables

// In production, these would be set by the deployment process
window.API_BASE_URL = 'http://localhost:4000';
window.BACKEND_URL = 'http://localhost:5000';

// For local development with Docker, use these settings:
// window.API_BASE_URL = 'http://auth:4000';
// window.BACKEND_URL = 'http://backend:5000';

console.log('Frontend configuration loaded:', {
  API_BASE_URL: window.API_BASE_URL,
  BACKEND_URL: window.BACKEND_URL
});
