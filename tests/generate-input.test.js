const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGenerateInput } = require('../api/generate');
const { validGenerateBody } = require('./helpers/startTestApp');

test('a valid body passes and notes are trimmed', () => {
  const result = validateGenerateInput(validGenerateBody({ notes: '   ' + 'x'.repeat(40) + '   ' }));
  assert.equal(result.ok, true);
  assert.equal(result.value.notes, 'x'.repeat(40));
});

test('count must be a whole number (3.5 is rejected)', () => {
  const result = validateGenerateInput(validGenerateBody({ count: 3.5 }));
  assert.equal(result.ok, false);
  assert.match(result.error, /whole number/);
});

test('count outside 3-20 or as a string is rejected', () => {
  assert.equal(validateGenerateInput(validGenerateBody({ count: 2 })).ok, false);
  assert.equal(validateGenerateInput(validGenerateBody({ count: 21 })).ok, false);
  assert.equal(validateGenerateInput(validGenerateBody({ count: '5' })).ok, false);
});

test('unknown type or difficulty is rejected', () => {
  assert.equal(validateGenerateInput(validGenerateBody({ type: 'essay' })).ok, false);
  assert.equal(validateGenerateInput(validGenerateBody({ difficulty: 'Insane' })).ok, false);
});

test('notes that are missing, not text, or too short are rejected', () => {
  assert.equal(validateGenerateInput(validGenerateBody({ notes: undefined })).ok, false);
  assert.equal(validateGenerateInput(validGenerateBody({ notes: 42 })).ok, false);
  assert.equal(validateGenerateInput(validGenerateBody({ notes: 'short' })).ok, false);
});

test('a missing body is rejected instead of crashing', () => {
  assert.equal(validateGenerateInput(undefined).ok, false);
});
