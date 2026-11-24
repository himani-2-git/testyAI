// ============================================================
//  api/createApp.js
//  Builds the Express app. Everything that talks to the outside
//  world (token check, quota store, LLM) is passed in, so tests can
//  use fakes and server.js can use the real ones.
//
//  Order of protection for /api/generate:
//    security headers -> CORS allowlist -> JSON body limit
//    -> IP rate limit -> Firebase ID token -> body validation
//    -> per-user daily quota -> LLM
// ============================================================

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { createSecurityHeaders } = require('./middleware/securityHeaders');
const { createCorsMiddleware } = require('./middleware/cors');
const { createRequireAuth } = require('./middleware/requireAuth');
const { createErrorHandler, apiNotFound } = require('./middleware/errorHandler');
const { createGenerateRoute } = require('./generate');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// 12,000 characters of notes is at most ~48 KB in UTF-8; 64 KB leaves room for the rest.
const JSON_BODY_LIMIT = '64kb';
const DEFAULT_IP_RATE_LIMIT = { windowMs: 60 * 60 * 1000, limit: 20 }; // 20 / hour / IP

function createApp({
  verifyIdToken,
  quotaStore,
  callLLM,
  allowedOrigins,
  firebaseAuthDomain,
  logger = console,
  ipRateLimit = DEFAULT_IP_RATE_LIMIT,
}) {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind one proxy; needed for correct client IPs

  app.use(createSecurityHeaders({ firebaseAuthDomain }));

  const api = express.Router();
  api.use(createCorsMiddleware(allowedOrigins));
  api.use(express.json({ limit: JSON_BODY_LIMIT }));

  const generateLimiter = rateLimit({
    ...ipRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again later.' },
  });
  const requireAuth = createRequireAuth({ verifyIdToken, logger });
  const generateRoute = createGenerateRoute({ callLLM, quotaStore, logger });

  api.post('/generate', generateLimiter, requireAuth, generateRoute);
  api.use(apiNotFound);

  app.use('/api', api);

  // Only /public is web-visible. Server code, rules and package files are not.
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp };
