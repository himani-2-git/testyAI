// ============================================================
//  api/providers/mock.js
//  A fake LLM for tests, CI and offline development.
//  Enabled with LLM_PROVIDER=mock (refused in production).
//  Returns fixed, schema-valid questions instantly, with no API key.
// ============================================================

const { validate } = require('../schemas');

function mockFlashcard(n) {
  return {
    front: `Mock flashcard ${n}: what is photosynthesis?`,
    back: 'The process plants use to turn light energy into chemical energy.',
    subject: 'Biology',
    topic: 'Photosynthesis',
  };
}

function mockMcq(n) {
  return {
    question: `Mock question ${n}: which gas do plants absorb for photosynthesis?`,
    options: ['A. Oxygen', 'B. Carbon dioxide', 'C. Nitrogen', 'D. Helium'],
    answer: 'B',
    explanation: 'Plants take in carbon dioxide and release oxygen.',
    subject: 'Biology',
    topic: n % 2 === 0 ? 'Photosynthesis' : 'Plant Respiration',
  };
}

function mockLong(n) {
  return {
    question: `Mock long question ${n}: explain the stages of photosynthesis.`,
    answer: '1. Light-dependent reactions make ATP and NADPH. 2. The Calvin cycle fixes carbon dioxide into sugar.',
    keyPoints: ['Light reactions', 'Calvin cycle', 'ATP and NADPH'],
    subject: 'Biology',
    topic: 'Photosynthesis',
  };
}

const BUILDERS = { flashcard: mockFlashcard, mcq: mockMcq, long: mockLong };

async function callMockProvider({ type, count }) {
  const build = BUILDERS[type];
  const questions = Array.from({ length: count }, (_, i) => build(i + 1));
  const result = { questions, subject: 'Biology' };

  const check = validate(type, result);
  if (!check.valid) throw new Error(`mock produced invalid output: ${check.error}`);
  return { result, provider: 'mock' };
}

module.exports = { callMockProvider };
