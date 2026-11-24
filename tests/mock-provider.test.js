const test = require('node:test');
const assert = require('node:assert/strict');
const { callMockProvider } = require('../api/providers/mock');
const { validate } = require('../api/schemas');

for (const type of ['flashcard', 'mcq', 'long']) {
  test(`mock provider returns ${type} questions that pass schema validation`, async () => {
    const { result, provider } = await callMockProvider({ type, count: 4 });
    assert.equal(provider, 'mock');
    assert.equal(result.questions.length, 4);
    assert.equal(validate(type, result).valid, true);
  });
}
