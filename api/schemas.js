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

const SCHEMAS = { flashcard: FLASHCARD_SCHEMA, mcq: MCQ_SCHEMA, long: LONG_SCHEMA };

// ── Lightweight validator (no external deps) ──
// Validates the parsed object against our schema rules.
function validate(type, parsed) {
  const schema = SCHEMAS[type];
  if (!schema) return { valid: false, error: `Unknown type: ${type}` };

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions)) {
    return { valid: false, error: 'Response missing "questions" array' };
  }

  const items = parsed.questions;
  if (!items.length) return { valid: false, error: 'Empty questions array returned' };

  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    const itemSchema = schema.properties.questions.items;

    // Check required fields
    for (const field of itemSchema.required) {
      if (q[field] === undefined || q[field] === null || q[field] === '') {
        return { valid: false, error: `Question ${i + 1} missing field: "${field}"` };
      }
    }

    // Type-specific checks
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
