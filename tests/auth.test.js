const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, postGenerate, VALID_TOKEN } = require('./helpers/startTestApp');

test('POST /api/generate without a token returns 401', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { token: null });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Please sign in again.' });
  } finally {
    await app.close();
  }
});

test('POST /api/generate with an invalid token returns 401 and does not leak the reason', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { token: 'forged-token' });
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.ok(!text.includes('signature'), 'the verifier error must stay in server logs');
  } finally {
    await app.close();
  }
});

test('a header that is not "Bearer <token>" returns 401', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, {
      token: null,
      headers: { Authorization: `Basic ${VALID_TOKEN}` },
    });
    assert.equal(res.status, 401);
  } finally {
    await app.close();
  }
});

test('POST /api/generate with a valid token returns questions from the mock provider', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.questions.length, 3);
    assert.equal(data.provider, 'mock');
  } finally {
    await app.close();
  }
});

test('the token is checked before the body, so unauthenticated callers learn nothing', async () => {
  const app = await startTestApp();
  try {
    const res = await postGenerate(app.url, { token: null, body: { notes: 'x' } });
    assert.equal(res.status, 401);
  } finally {
    await app.close();
  }
});
