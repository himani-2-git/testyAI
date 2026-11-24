// Starts the real Express app on a random free port, with fakes for the
// parts that need the network (Firebase token check, Firestore quota, LLM).
const { createApp } = require('../../api/createApp');
const { createMemoryQuotaStore } = require('../../api/quota');
const { callMockProvider } = require('../../api/providers/mock');

const VALID_TOKEN = 'valid-token-for-user-a';
const VALID_TOKEN_B = 'valid-token-for-user-b';

async function fakeVerifyIdToken(token) {
  if (token === VALID_TOKEN) return { uid: 'user-a' };
  if (token === VALID_TOKEN_B) return { uid: 'user-b' };
  throw new Error('Firebase ID token has invalid signature');
}

const silentLogger = {
  info() {},
  warn() {},
  error() {},
};

async function startTestApp(overrides = {}) {
  const options = {
    verifyIdToken: fakeVerifyIdToken,
    quotaStore: createMemoryQuotaStore({ limit: 5 }),
    callLLM: callMockProvider,
    allowedOrigins: ['http://localhost:8080'],
    firebaseAuthDomain: 'test-project.firebaseapp.com',
    logger: silentLogger,
    ...overrides,
  };
  const app = createApp(options);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  async function close() {
    await new Promise((resolve) => server.close(resolve));
  }

  return { url, close };
}

function validGenerateBody(overrides = {}) {
  return {
    notes: 'Photosynthesis converts light energy into chemical energy in plants.',
    type: 'mcq',
    count: 3,
    difficulty: 'Easy',
    ...overrides,
  };
}

async function postGenerate(url, { token = VALID_TOKEN, body = validGenerateBody(), headers = {} } = {}) {
  const allHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) allHeaders.Authorization = `Bearer ${token}`;
  return fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: allHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

module.exports = {
  startTestApp,
  postGenerate,
  validGenerateBody,
  silentLogger,
  VALID_TOKEN,
  VALID_TOKEN_B,
};
