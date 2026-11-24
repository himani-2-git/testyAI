// ============================================================
//  api/middleware/errorHandler.js
//  Last stop for any error. Users get a short, generic JSON message.
//  The full details (message + stack) go to the server log only.
// ============================================================

const KNOWN_BODY_ERRORS = {
  'entity.parse.failed': { status: 400, message: 'The request body is not valid JSON.' },
  'entity.too.large': { status: 413, message: 'The request is too large.' },
};

function createErrorHandler(logger) {
  // Express recognises error handlers by their 4 arguments, so `_next` must stay.
  return function errorHandler(err, req, res, _next) {
    const known = KNOWN_BODY_ERRORS[err.type];
    let status = known ? known.status : err.status || 500;
    if (status < 400 || status > 599) status = 500;

    let message = 'Something went wrong. Please try again.';
    if (known) message = known.message;
    else if (err.publicMessage) message = err.publicMessage;

    logger.error(`[error] ${req.method} ${req.originalUrl} -> ${status}: ${err.stack || err.message}`);
    res.status(status).json({ error: message });
  };
}

function apiNotFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

module.exports = { createErrorHandler, apiNotFound };
