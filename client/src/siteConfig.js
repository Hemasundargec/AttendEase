// One place for site-wide values so pages never hardcode them.
export const site = {
  name: 'AttendEase',
  url: (import.meta.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  // TODO: replace with a real address you check before launch (used in the legal pages).
  contactEmail: 'contact@your-domain.example',
  college: 'Seshadri Rao Gudlavalleru Engineering College (SRGEC)',
  gaId: import.meta.env.VITE_GA_ID || '',
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
  legalUpdated: '23 October 2026',
}
