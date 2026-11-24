const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../public/js/ui');

test('escapeHtml escapes all five HTML-special characters', () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('escapeHtml turns null, undefined and numbers into safe strings', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});
