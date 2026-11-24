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

test('more than 20 questions is rejected', () => {
  const many = { questions: Array.from({ length: 21 }, () => mcq().questions[0]) };
  assert.equal(validate('mcq', many).valid, false);
});

test('an extremely long string is rejected', () => {
  assert.equal(validate('mcq', mcq({ explanation: 'x'.repeat(5000) })).valid, false);
});

test('an overly long subject or topic is rejected', () => {
  assert.equal(validate('mcq', mcq({ subject: 'S'.repeat(81) })).valid, false);
  assert.equal(validate('mcq', mcq({ topic: 'T'.repeat(81) })).valid, false);
});

test('unknown fields from the model are removed, not passed to the browser', () => {
  const data = mcq({ onclick: 'alert(1)' });
  data.extraRootField = 'x';
  assert.equal(validate('mcq', data).valid, true);
  assert.equal('onclick' in data.questions[0], false);
  assert.equal('extraRootField' in data, false);
});

test('a root-level subject is kept', () => {
  const data = mcq();
  data.subject = 'Biology';
  assert.equal(validate('mcq', data).valid, true);
  assert.equal(data.subject, 'Biology');
});
