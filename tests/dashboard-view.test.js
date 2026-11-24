const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../public/js/dashboardView');

// The subject comes from the LLM, so notes can try to inject markup through it.
const ATTACK_SUBJECT = `x');alert(1);//" onmouseover="alert(2)`;

// Escaped attack text may still contain the WORD "onmouseover"; that is harmless.
// What must never appear: a raw quote that ends an attribute and starts a handler,
// an onclick we wrote ourselves, or any HTML tag that is not one of ours.
const OUR_TAGS = /<(?!\/?(div|span|button|strong|br)\b)/i;

function assertNoInjection(html) {
  assert.ok(!/onclick\s*=/i.test(html), 'no inline onclick handlers');
  assert.ok(!/["']\s*on\w+\s*=/i.test(html), 'no raw quote breaks out of an attribute');
  assert.ok(!html.includes(`');alert`), 'single quote is escaped');
  assert.ok(!OUR_TAGS.test(html), 'no injected tags such as <img> or <script>');
}

test('subject chips: a malicious subject cannot inject script', () => {
  const html = view.subjectChipsHtml({
    subjects: [ATTACK_SUBJECT],
    topicCounts: { [ATTACK_SUBJECT]: 1 },
    totalCount: 1,
    activeSubject: 'all',
  });
  assertNoInjection(html);
  assert.ok(html.includes('data-subject="'), 'subject is passed in a data attribute');
});

test('topic rows: malicious subject and topic are escaped', () => {
  const html = view.topicRowsHtml(
    [{ subject: ATTACK_SUBJECT, topic: '<img src=x onerror=alert(3)>', accuracy: 40 }],
    { kind: 'weak', showSubjectTag: true }
  );
  assertNoInjection(html);
  assert.ok(html.includes('&lt;img'));
});

test('history items: every stored field is escaped and the id goes in a data attribute', () => {
  const html = view.historyItemsHtml([{
    id: `abc');alert(1);//`,
    title: '<b>t</b>',
    type: '"><script>',
    difficulty: '<i>',
    questionCount: '<u>',
    scorePercent: 80,
    createdAt: null,
  }]);
  assertNoInjection(html);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>t</b>'));
  assert.ok(html.includes('data-test-id="abc&#39;);alert(1);//"'));
});

test('empty-state messages use the real 60% / 75% thresholds', () => {
  assert.match(view.noWeakTopicsMessage('all'), /below 60%/);
  assert.match(view.noWeakTopicsMessage('Physics'), /Physics.*60%/);
  assert.match(view.noStrongTopicsMessage('all'), /75%/);
  assert.match(view.noStrongTopicsMessage('Physics'), /75%/);
  assert.ok(!view.noWeakTopicsMessage('all').includes('75%'));
  assert.ok(!view.noStrongTopicsMessage('all').includes('60%'));
});

test('chart: stored scores are forced to numbers and dates are escaped', () => {
  const html = view.chartHtml([{ score: '<script>', date: '2026-<b>' }]);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('0%'));
});

test('empty-state messages escape the subject name', () => {
  assert.ok(!view.noWeakTopicsMessage('<b>x</b>').includes('<b>'));
});
