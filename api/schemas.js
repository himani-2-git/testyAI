// ============================================================
//  api/schemas.js
//  JSON Schemas for each test type + server-side validation.
//  Every LLM response is checked here before it reaches the browser.
//
//  - Size limits (maxItems, maxLength) stop a confused or manipulated
//    model from returning huge or endless output.
//  - Unknown fields are REMOVED (Ajv removeAdditional), so only the
//    fields below are ever sent to the browser or saved.
// ============================================================

const Ajv = require('ajv');

const MAX_QUESTIONS = 20;
const LABEL_MAX = 80;       // subject, topic
const SHORT_TEXT_MAX = 1000; // question, front, option, key point
const LONG_TEXT_MAX = 4000;  // answer, back, explanation

const text = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const label = { type: 'string', maxLength: LABEL_MAX };
const requiredLabel = { type: 'string', minLength: 1, maxLength: LABEL_MAX };

function wrapQuestions(itemSchema) {
  return {
    type: 'object',
    properties: {
      questions: { type: 'array', items: itemSchema, minItems: 1, maxItems: MAX_QUESTIONS },
      subject: label,
    },
    required: ['questions'],
    additionalProperties: false,
  };
}

const FLASHCARD_SCHEMA = wrapQuestions({
  type: 'object',
  properties: {
    front: text(SHORT_TEXT_MAX),
    back: text(LONG_TEXT_MAX),
    subject: label,
    topic: requiredLabel,
  },
  required: ['front', 'back', 'topic'],
  additionalProperties: false,
});

const MCQ_SCHEMA = wrapQuestions({
  type: 'object',
  properties: {
    question: text(SHORT_TEXT_MAX),
    options: { type: 'array', items: text(SHORT_TEXT_MAX), minItems: 4, maxItems: 4 },
    answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    explanation: text(LONG_TEXT_MAX),
    subject: label,
    topic: requiredLabel,
  },
  required: ['question', 'options', 'answer', 'explanation', 'topic'],
  additionalProperties: false,
});

const LONG_SCHEMA = wrapQuestions({
  type: 'object',
  properties: {
    question: text(SHORT_TEXT_MAX),
    answer: text(LONG_TEXT_MAX),
    keyPoints: { type: 'array', items: text(SHORT_TEXT_MAX), minItems: 1, maxItems: 10 },
    subject: label,
    topic: requiredLabel,
  },
  required: ['question', 'answer', 'keyPoints', 'topic'],
  additionalProperties: false,
});

// removeAdditional: 'all' deletes properties not listed in the schema (it changes the object in place).
const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });

const SCHEMAS = { flashcard: FLASHCARD_SCHEMA, mcq: MCQ_SCHEMA, long: LONG_SCHEMA };

const COMPILED_VALIDATORS = {
  flashcard: ajv.compile(FLASHCARD_SCHEMA),
  mcq: ajv.compile(MCQ_SCHEMA),
  long: ajv.compile(LONG_SCHEMA),
};

function formatErrors(errors) {
  if (!errors) return 'Schema validation failed';
  return errors.map((e) => `${e.instancePath || 'root'} ${e.message}`).join(', ');
}

/** Validates (and cleans) a parsed model response. Returns { valid, error? }. */
function validate(type, parsed) {
  const validator = COMPILED_VALIDATORS[type];
  if (!validator) return { valid: false, error: `Unknown type: ${type}` };

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Response must be a JSON object' };
  }

  if (!validator(parsed)) {
    return { valid: false, error: formatErrors(validator.errors) };
  }
  return { valid: true };
}

module.exports = { SCHEMAS, validate, MAX_QUESTIONS };
