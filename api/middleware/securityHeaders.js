// ============================================================
//  api/middleware/securityHeaders.js
//  HTTP security headers via helmet.
//
//  The Content-Security-Policy is RELAXED for now: the current pages
//  use inline <script> blocks and onclick="" attributes, so
//  'unsafe-inline' is still needed. Phase 2 (React) removes those and
//  switches to a strict policy. Even relaxed, the policy limits which
//  websites can serve scripts, blocks plugins (<object>) and stops
//  other sites from framing the app (clickjacking).
// ============================================================

const helmet = require('helmet');

const FIREBASE_SDK = 'https://www.gstatic.com';
const CDNJS = 'https://cdnjs.cloudflare.com';
const GOOGLE_APIS_SCRIPT = 'https://apis.google.com';

function buildCspDirectives(firebaseAuthDomain) {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", FIREBASE_SDK, CDNJS, GOOGLE_APIS_SCRIPT],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    // Google profile pictures come from googleusercontent.com.
    imgSrc: ["'self'", 'data:', 'https:'],
    // Firebase Auth and Firestore talk to *.googleapis.com.
    connectSrc: ["'self'", 'https://*.googleapis.com', GOOGLE_APIS_SCRIPT],
    // The Google sign-in popup uses a hidden iframe on the auth domain.
    frameSrc: [`https://${firebaseAuthDomain}`, 'https://accounts.google.com', GOOGLE_APIS_SCRIPT],
    // PDF.js starts its worker from the CDN through a blob: URL.
    workerSrc: ["'self'", 'blob:', CDNJS],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
}

function createSecurityHeaders({ firebaseAuthDomain }) {
  return helmet({
    contentSecurityPolicy: { directives: buildCspDirectives(firebaseAuthDomain) },
    // "same-origin" would break signInWithPopup, which must talk to its popup window.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });
}

module.exports = { createSecurityHeaders, buildCspDirectives };
