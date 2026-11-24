const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../api/config');

const fakeServiceAccount = {
  type: 'service_account',
  project_id: 'demo-project',
  client_email: 'firebase-adminsdk@demo-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nSECRETVALUE\n-----END PRIVATE KEY-----\n',
};

function base64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function validEnv(overrides = {}) {
  return {
    FIREBASE_SERVICE_ACCOUNT_BASE64: base64(fakeServiceAccount),
    GROQ_API_KEY: 'gsk_test',
    ...overrides,
  };
}

test('a valid environment loads with sensible defaults', () => {
  const config = loadConfig(validEnv());
  assert.equal(config.port, 8080);
  assert.equal(config.llmProvider, 'auto');
  assert.equal(config.dailyGenerationQuota, 30);
  assert.deepEqual(config.allowedOrigins, ['http://localhost:8080']);
  assert.equal(config.firebaseServiceAccount.project_id, 'demo-project');
  assert.equal(config.firebaseAuthDomain, 'demo-project.firebaseapp.com');
});

test('missing service account fails with a clear message that names the variable', () => {
  assert.throws(
    () => loadConfig(validEnv({ FIREBASE_SERVICE_ACCOUNT_BASE64: undefined })),
    /FIREBASE_SERVICE_ACCOUNT_BASE64 is missing/
  );
});

test('a service account that is not valid base64 JSON fails clearly', () => {
  assert.throws(
    () => loadConfig(validEnv({ FIREBASE_SERVICE_ACCOUNT_BASE64: 'not-base64-json' })),
    /FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid/
  );
});

test('a service account missing fields fails clearly', () => {
  const incomplete = base64({ project_id: 'x' });
  assert.throws(
    () => loadConfig(validEnv({ FIREBASE_SERVICE_ACCOUNT_BASE64: incomplete })),
    /client_email, private_key/
  );
});

test('error messages never contain secret values', () => {
  try {
    loadConfig(validEnv({ GROQ_API_KEY: undefined, DAILY_GENERATION_QUOTA: 'lots' }));
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(!err.message.includes('SECRETVALUE'));
    assert.ok(!err.message.includes(validEnv().FIREBASE_SERVICE_ACCOUNT_BASE64));
  }
});

test('all problems are reported together, not one at a time', () => {
  try {
    loadConfig({ DAILY_GENERATION_QUOTA: '0' });
    assert.fail('should have thrown');
  } catch (err) {
    assert.match(err.message, /FIREBASE_SERVICE_ACCOUNT_BASE64/);
    assert.match(err.message, /GROQ_API_KEY or CEREBRAS_API_KEY/);
    assert.match(err.message, /DAILY_GENERATION_QUOTA/);
  }
});

test('an LLM key is not needed when LLM_PROVIDER=mock', () => {
  const config = loadConfig(validEnv({ GROQ_API_KEY: undefined, LLM_PROVIDER: 'mock' }));
  assert.equal(config.llmProvider, 'mock');
});

test('the mock provider is refused in production', () => {
  assert.throws(
    () => loadConfig(validEnv({ LLM_PROVIDER: 'mock', NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://a.example' })),
    /LLM_PROVIDER=mock is not allowed in production/
  );
});

test('production requires ALLOWED_ORIGINS', () => {
  assert.throws(() => loadConfig(validEnv({ NODE_ENV: 'production' })), /ALLOWED_ORIGINS is required/);
});

test('ALLOWED_ORIGINS is split on commas and trimmed', () => {
  const config = loadConfig(validEnv({ ALLOWED_ORIGINS: 'https://a.example, https://b.example ' }));
  assert.deepEqual(config.allowedOrigins, ['https://a.example', 'https://b.example']);
});

test('an unknown LLM_PROVIDER or a bad PORT is rejected', () => {
  assert.throws(() => loadConfig(validEnv({ LLM_PROVIDER: 'openai' })), /LLM_PROVIDER/);
  assert.throws(() => loadConfig(validEnv({ PORT: 'eighty' })), /PORT/);
});
