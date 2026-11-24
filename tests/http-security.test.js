const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, postGenerate, validGenerateBody } = require('./helpers/startTestApp');

test('security headers are set and X-Powered-By is removed', async () => {
  const app = await startTestApp();
  try {
    const res = await fetch(`${app.url}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'a Content-Security-Policy header is sent');
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /https:\/\/test-project\.firebaseapp\.com/, 'Firebase sign-in frame is allowed');
    // Google sign-in uses a popup, which a strict same-origin COOP would break.
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  } finally {
    await app.close();
  }
});

test('CORS: a request from an allowed origin gets the allow-origin header', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { headers: { Origin: 'http://localhost:8080' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  } finally {
    await app.close();
  }
});

test('CORS: a request from another website is refused with 403', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'This website is not allowed to call the API.' });
  } finally {
    await app.close();
  }
});

test('malformed JSON returns a short JSON error, not a stack trace', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { body: '{bad' });
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.equal(text, JSON.stringify({ error: 'The request body is not valid JSON.' }));
  } finally {
    await app.close();
  }
});

test('a body larger than the limit returns 413 with a generic message', async () => {
  const app = await startTestApp();
  try {
    const hugeNotes = 'a'.repeat(200 * 1024);
    const res = await postGenerate(app.url, { body: validGenerateBody({ notes: hugeNotes }) });
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: 'The request is too large.' });
  } finally {
    await app.close();
  }
});

test('an unexpected server error returns a generic 500 and logs the details', async () => {
  const logged = [];
  const logger = { info() {}, warn() {}, error: (...args) => logged.push(args.join(' ')) };
  const crashingLLM = async () => {
    throw new Error('secret internal detail');
  };
  const app = await startTestApp({ callLLM: crashingLLM, logger });
  try {
    const res = await postGenerate(app.url);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes('secret internal detail'));
    assert.ok(logged.some((line) => line.includes('secret internal detail')), 'details go to the log');
  } finally {
    await app.close();
  }
});

test('when all providers fail the user gets 502 and provider details stay private', async () => {
  const failingLLM = async () => {
    const err = new Error('All AI providers failed');
    err.details = ['groq-primary: 429 rate limit for org_123'];
    throw err;
  };
  const app = await startTestApp({ callLLM: failingLLM });
  try {
    const res = await postGenerate(app.url);
    assert.equal(res.status, 502);
    const text = await res.text();
    assert.ok(!text.includes('org_123'));
  } finally {
    await app.close();
  }
});

test('unknown /api routes return a JSON 404', async () => {
  const app = await startTestApp();
  try {
    const res = await fetch(`${app.url}/api/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  } finally {
    await app.close();
  }
});
