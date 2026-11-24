// ============================================================
//  api/middleware/cors.js
//  Strict CORS allowlist for /api.
//  - A browser request from an allowed origin gets the CORS headers.
//  - A browser request from any other website is refused with 403.
//  - Requests without an Origin header (curl, server-to-server) pass
//    through; they are still stopped by requireAuth.
//  CORS only protects users' browsers. Authentication is what
//  protects the API itself.
// ============================================================

const cors = require('cors');

function createCorsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins);

  return cors({
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        return callback(null, true);
      }
      const err = new Error(`Origin not allowed: ${origin}`);
      err.status = 403;
      err.publicMessage = 'This website is not allowed to call the API.';
      return callback(err);
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}

module.exports = { createCorsMiddleware };
