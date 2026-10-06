// ============================================================
//  api/schemas.js
//  JSON Schemas for each test type + server-side validation.
//  Schemas are used BOTH to instruct the model (structured-output
//  mode) AND to validate what comes back before sending to client.
// ============================================================

// ── Schemas (wrapped in { questions: [...] } so root is always object) ──

const FLASHCARD_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front:   { type: 'string', minLength: 1 },
          back:    { type: 'string', minLength: 1 },
          subject: { type: 'string' },
          topic:   { type: 'string', minLength: 1 }
        },
        required: ['front', 'back', 'topic'],
        additionalProperties: true
      },
      minItems: 1
    }
  },
  required: ['questions'],
  additionalProperties: true
};

const MCQ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question:    { type: 'string', minLength: 1 },
          options:     {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 4,
            maxItems: 4
          },
          answer:      { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          explanation: { type: 'string', minLength: 1 },
          subject:     { type: 'string' },
          topic:       { type: 'string', minLength: 1 }
        },
        required: ['question', 'options', 'answer', 'explanation', 'topic'],
        additionalProperties: true
      },
      minItems: 1
    }
  },
  required: ['questions'],
  additionalProperties: true
};

const LONG_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question:   { type: 'string', minLength: 1 },
          answer:     { type: 'string', minLength: 1 },
          keyPoints:  {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1
          },
          subject:    { type: 'string' },
          topic:      { type: 'string', minLength: 1 }
        },
        required: ['question', 'answer', 'keyPoints', 'topic'],
        additionalProperties: true
      },
      minItems: 1
    }
  },
  required: ['questions'],
  additionalProperties: true
};

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

const SCHEMAS = { flashcard: FLASHCARD_SCHEMA, mcq: MCQ_SCHEMA, long: LONG_SCHEMA };

const COMPILED_VALIDATORS = {
  flashcard: ajv.compile(FLASHCARD_SCHEMA),
  mcq: ajv.compile(MCQ_SCHEMA),
  long: ajv.compile(LONG_SCHEMA)
};

// ── Validator using compiled Ajv schemas + type-specific checks ──
function validate(type, parsed) {
  const validator = COMPILED_VALIDATORS[type];
  if (!validator) return { valid: false, error: `Unknown type: ${type}` };

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Response must be a JSON object' };
  }

  // 1. Validate against compiled Ajv JSON schema
  const isValid = validator(parsed);
  if (!isValid) {
    const errorMsg = validator.errors
      ? validator.errors.map(e => `${e.instancePath || 'root'} ${e.message}`).join(', ')
      : 'Schema validation failed';
    return { valid: false, error: errorMsg };
  }

  // 2. Type-specific checks (e.g. MCQ must have exactly 4 options)
  const items = parsed.questions;
  for (let i = 0; i < items.length; i++) {
    const q = items[i];

    if (type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return { valid: false, error: `Question ${i + 1}: options must be exactly 4 strings` };
      }
      if (!['A', 'B', 'C', 'D'].includes(q.answer)) {
        return { valid: false, error: `Question ${i + 1}: answer must be A, B, C, or D` };
      }
    }

    if (type === 'long') {
      if (!Array.isArray(q.keyPoints) || q.keyPoints.length === 0) {
        return { valid: false, error: `Question ${i + 1}: keyPoints must be a non-empty array` };
      }
    }
  }

  return { valid: true };
}

module.exports = { SCHEMAS, validate };
