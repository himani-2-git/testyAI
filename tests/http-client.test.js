const test = require('node:test');
const assert = require('node:assert/strict');
const { readJsonResponse } = require('../public/js/http');

test('a JSON success response is returned as data', async () => {
  const res = new Response(JSON.stringify({ questions: [1] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.deepEqual(await readJsonResponse(res), { questions: [1] });
});

test('a JSON error response throws the server message', async () => {
  const res = new Response(JSON.stringify({ error: 'Daily limit reached.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(readJsonResponse(res), /Daily limit reached\./);
});

test('an HTML error page (e.g. Render 502) gives a friendly message, not a parse error', async () => {
  const res = new Response('<html>Bad Gateway</html>', {
    status: 502,
    headers: { 'Content-Type': 'text/html' },
  });
  await assert.rejects(readJsonResponse(res), (err) => {
    assert.match(err.message, /server is not responding/i);
    assert.ok(!/Unexpected token|JSON/.test(err.message));
    return true;
  });
});

test('a 200 response that is not JSON is treated as an error', async () => {
  const res = new Response('oops', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  await assert.rejects(readJsonResponse(res), /unexpected response/i);
});

test('a 401 response asks the user to sign in again', async () => {
  const res = new Response('', { status: 401 });
  await assert.rejects(readJsonResponse(res), /sign in again/i);
});
