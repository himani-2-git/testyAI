// ============================================================
//  api/generate.js
//  Express route handler for POST /api/generate
//
//  Flow:
//    1. Validate incoming request body
//    2. Build system + user prompts (server-side)
//    3. Call AI via provider abstraction (Groq → Cerebras)
//    4. Validate returned JSON against our schema
//    5. Return clean, validated array to frontend
// ============================================================

const { buildSystemPrompt, buildUserPrompt } = require('./prompts');
const { callWithFallback }                   = require('./providers/index');
const { validate }                           = require('./schemas');

const VALID_TYPES       = ['flashcard', 'mcq', 'long'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MIN_COUNT = 3;
const MAX_COUNT = 20;
const MIN_NOTES_LENGTH = 30;
const MAX_NOTES_LENGTH = 12000; // chars (~3000 tokens, safe for both providers)

module.exports = async function generateRoute(req, res) {
  try {
    // ── 1. Input validation ──
    const { notes, type, count, difficulty } = req.body;

    if (!notes || typeof notes !== 'string' || notes.trim().length < MIN_NOTES_LENGTH) {
      return res.status(400).json({ error: 'Notes must be at least 30 characters.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (typeof count !== 'number' || count < MIN_COUNT || count > MAX_COUNT) {
      return res.status(400).json({ error: `count must be between ${MIN_COUNT} and ${MAX_COUNT}` });
    }
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}` });
    }

    const safeNotes = notes.trim().slice(0, MAX_NOTES_LENGTH);

    // ── 2. Build prompts ──
    const systemPrompt = buildSystemPrompt(type);
    const userPrompt   = buildUserPrompt(type, count, difficulty, safeNotes);

    // ── 3. Call AI (with automatic Groq → Cerebras fallback) ──
    const { result, provider } = await callWithFallback(systemPrompt, userPrompt, type);

    // ── 4. Server-side schema validation ──
    const { valid, error: validationError } = validate(type, result);
    if (!valid) {
      console.error(`[generate] Schema validation failed (${provider}): ${validationError}`);
      return res.status(502).json({
        error: `AI returned invalid data: ${validationError}. Please try again.`
      });
    }

    // ── 5. Return validated questions array ──
    return res.json({
      questions: result.questions,
      subject: result.subject || null,
      provider            // Optional: visible in browser devtools for debugging
    });

  } catch (err) {
    console.error('[generate] Unhandled error:', err.message);
    return res.status(500).json({ error: err.message || 'Generation failed. Please try again.' });
  }
};
