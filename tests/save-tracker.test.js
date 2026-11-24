const test = require('node:test');
const assert = require('node:assert/strict');
const { createSaveTracker } = require('../public/js/saveTracker');

test('waitForId waits for a save that has not finished yet (old bug: score was lost)', async () => {
  let finishSave;
  const slowSave = () => new Promise((resolve) => { finishSave = resolve; });
  const tracker = createSaveTracker(slowSave);

  tracker.start({ title: 'Notes' });
  const idPromise = tracker.waitForId();
  finishSave('test-123');
  assert.equal(await idPromise, 'test-123');
});

test('waitForId retries once when the first save failed', async () => {
  let calls = 0;
  const flakySave = async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return 'test-456';
  };
  const tracker = createSaveTracker(flakySave);
  tracker.start({ title: 'Notes' });
  assert.equal(await tracker.waitForId(), 'test-456');
  assert.equal(calls, 2);
});

test('waitForId rejects when the retry also fails, so the page can tell the user', async () => {
  const brokenSave = async () => { throw new Error('permission denied'); };
  const tracker = createSaveTracker(brokenSave);
  tracker.start({ title: 'Notes' });
  await assert.rejects(tracker.waitForId(), /permission denied/);
});

test('waitForId before any save has started rejects clearly', async () => {
  const tracker = createSaveTracker(async () => 'x');
  await assert.rejects(tracker.waitForId(), /No test has been saved/);
});

test('starting a new save replaces the old one (e.g. after Regenerate)', async () => {
  const ids = ['first', 'second'];
  const tracker = createSaveTracker(async () => ids.shift());
  tracker.start({});
  await tracker.waitForId();
  tracker.start({});
  assert.equal(await tracker.waitForId(), 'second');
});
