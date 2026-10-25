const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../api/schemas');

const mcq = (over = {}) => ({ questions: [{ question: 'Q?', options: ['A. a', 'B. b', 'C. c', 'D. d'],
  answer: 'B', explanation: 'because', topic: 'T', ...over }] });

test('valid MCQ passes', () => assert.equal(validate('mcq', mcq()).valid, true));
test('MCQ with 3 options is rejected', () => assert.equal(validate('mcq', mcq({ options: ['a', 'b', 'c'] })).valid, false));
test('MCQ with answer "E" is rejected', () => assert.equal(validate('mcq', mcq({ answer: 'E' })).valid, false));
test('non-object / unknown type are rejected', () => {
  assert.equal(validate('mcq', null).valid, false);
  assert.equal(validate('essay', {}).valid, false);
});
