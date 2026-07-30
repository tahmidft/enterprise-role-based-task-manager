// Runtime config for production (overridden at deploy time / by hosting env inject).
// Local fallback keeps the Angular app pointed at the Nest API.
window.__env = window.__env || {
  API_URL: 'http://localhost:3333/api',
};
