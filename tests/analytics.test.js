const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/js/analytics');

test('streak: consecutive day increments, gap resets, same day is a no-op', () => {
  const base = { currentStreak: 4, longestStreak: 9, lastActiveDate: '2026-10-22' };
  assert.equal(A.nextStreak(base, '2026-10-23').currentStreak, 5);
  assert.equal(A.nextStreak(base, '2026-10-25').currentStreak, 1);
  assert.equal(A.nextStreak(base, '2026-10-22').currentStreak, 4);
  assert.equal(A.nextStreak(base, '2026-10-25').longestStreak, 9);
});

test('streak: month and DST boundaries count as one day', () => {
  assert.equal(A.daysBetween('2026-10-31', '2026-11-01'), 1);
  assert.equal(A.daysBetween('2026-03-07', '2026-03-09'), 2);
});

test('a 70% topic is not both weak and strong', () => {
  const perf = { 'Math • Algebra': { subject: 'Math', cleanTopic: 'Algebra', correct: 7, total: 10 } };
  assert.equal(A.getWeakTopics(perf).length, 0);
  assert.equal(A.getStrongTopics(perf).length, 0);
});

test('weak sorted lowest first, strong highest first', () => {
  const mk = (c) => ({ subject: 'S', cleanTopic: 'T' + c, correct: c, total: 10 });
  const perf = { a: mk(2), b: mk(5), c: mk(9), d: mk(8) };
  assert.deepEqual(A.getWeakTopics(perf).map(t => t.accuracy), [20, 50]);
  assert.deepEqual(A.getStrongTopics(perf).map(t => t.accuracy), [90, 80]);
});

test('buildNotes: every document gets a share of the budget', () => {
  const docs = ['A', 'B', 'C'].map(n => ({ name: n + '.pdf', text: n.repeat(9000) }));
  const out = A.buildNotes(docs, 12000);
  for (const n of ['A', 'B', 'C']) assert.ok(out.includes(`=== DOCUMENT: ${n}.pdf ===`) && out.includes(n.repeat(3500)));
  assert.ok(out.length <= 12000 + 200);
});

test('mergeTopicPerf keeps subject metadata and accumulates counts', () => {
  const r = { 'ML • PCA': { subject: 'ML', cleanTopic: 'PCA', correct: 2, total: 3 } };
  const once = A.mergeTopicPerf({}, r);
  const twice = A.mergeTopicPerf(once, r);
  assert.deepEqual(twice['ML • PCA'], { subject: 'ML', cleanTopic: 'PCA', correct: 4, total: 6 });
});
