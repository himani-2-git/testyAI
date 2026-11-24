// ============================================================
//  api/middleware/requireAuth.js
//  Every /api request must carry "Authorization: Bearer <Firebase ID token>".
//  The token is checked on the server with the Firebase Admin SDK
//  (signature, expiry, project). On success req.user = { uid }.
// ============================================================

const BEARER_PREFIX = 'Bearer ';

function readBearerToken(req) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token || null;
}

function createRequireAuth({ verifyIdToken, logger }) {
  return async function requireAuth(req, res, next) {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Please sign in again.' });
    }

    try {
      const decoded = await verifyIdToken(token);
      req.user = { uid: decoded.uid };
      return next();
    } catch (err) {
      // The reason (expired, bad signature...) is useful for us, not for an attacker.
      logger.warn(`[auth] token rejected: ${err.message}`);
      return res.status(401).json({ error: 'Please sign in again.' });
    }
  };
}

module.exports = { createRequireAuth };
