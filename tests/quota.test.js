const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consumeQuota,
  refundQuota,
  utcDateString,
  createMemoryQuotaStore,
} = require('../api/quota');
const { startTestApp, postGenerate, VALID_TOKEN_B } = require('./helpers/startTestApp');

test('consumeQuota: first use of the day starts at 1', () => {
  const decision = consumeQuota(null, '2026-11-24', 3);
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.next, { date: '2026-11-24', count: 1 });
  assert.equal(decision.remaining, 2);
});

test('consumeQuota: refuses when the limit is reached', () => {
  const decision = consumeQuota({ date: '2026-11-24', count: 3 }, '2026-11-24', 3);
  assert.equal(decision.allowed, false);
  assert.equal(decision.remaining, 0);
});

test('consumeQuota: a new day resets the count', () => {
  const decision = consumeQuota({ date: '2026-11-23', count: 3 }, '2026-11-24', 3);
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.next, { date: '2026-11-24', count: 1 });
});

test('refundQuota: gives one back on the same day, never below zero', () => {
  assert.deepEqual(refundQuota({ date: '2026-11-24', count: 2 }, '2026-11-24'), { date: '2026-11-24', count: 1 });
  assert.equal(refundQuota({ date: '2026-11-24', count: 0 }, '2026-11-24'), null);
  assert.equal(refundQuota({ date: '2026-11-23', count: 2 }, '2026-11-24'), null);
  assert.equal(refundQuota(null, '2026-11-24'), null);
});

test('utcDateString uses the UTC calendar day', () => {
  assert.equal(utcDateString(new Date('2026-11-24T23:30:00Z')), '2026-11-24');
});

test('memory store: separate users have separate quotas', async () => {
  const store = createMemoryQuotaStore({ limit: 1 });
  assert.equal((await store.tryConsume('a')).allowed, true);
  assert.equal((await store.tryConsume('a')).allowed, false);
  assert.equal((await store.tryConsume('b')).allowed, true);
});

test('route: returns 429 with a clear message once the daily quota is used up', async () => {
  const app = await startTestApp({ quotaStore: createMemoryQuotaStore({ limit: 2 }) });
  try {
    assert.equal((await postGenerate(app.url)).status, 200);
    assert.equal((await postGenerate(app.url)).status, 200);
    const third = await postGenerate(app.url);
    assert.equal(third.status, 429);
    assert.match((await third.json()).error, /daily limit of 2/i);

    const otherUser = await postGenerate(app.url, { token: VALID_TOKEN_B });
    assert.equal(otherUser.status, 200, 'user B has their own quota');
  } finally {
    await app.close();
  }
});

test('route: a failed generation does not use up quota', async () => {
  const failingLLM = async () => {
    const err = new Error('All AI providers failed');
    err.details = ['groq: 503'];
    throw err;
  };
  const store = createMemoryQuotaStore({ limit: 1 });
  const app = await startTestApp({ quotaStore: store, callLLM: failingLLM });
  try {
    assert.equal((await postGenerate(app.url)).status, 502);
    assert.equal((await postGenerate(app.url)).status, 502, 'still allowed: the first failure was refunded');
  } finally {
    await app.close();
  }
});

test('route: an invalid body does not use up quota', async () => {
  const store = createMemoryQuotaStore({ limit: 1 });
  const app = await startTestApp({ quotaStore: store });
  try {
    const bad = await postGenerate(app.url, { body: { notes: 'too short' } });
    assert.equal(bad.status, 400);
    assert.equal((await postGenerate(app.url)).status, 200);
  } finally {
    await app.close();
  }
});
