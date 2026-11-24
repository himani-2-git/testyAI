// ============================================================
//  api/generate.js
//  POST /api/generate (runs after requireAuth, so req.user is set)
//
//  Flow:
//    1. Validate the request body          -> 400 if invalid
//    2. Take one unit of the daily quota   -> 429 if used up
//    3. Build system + user prompts
//    4. Call the LLM (provider fallback, or the mock in tests)
//       Every response is checked with Ajv inside the provider layer.
//    5. Return the validated questions
//  If step 3-5 fails, the quota unit is given back.
// ============================================================

const { buildSystemPrompt, buildUserPrompt } = require('./prompts');

const VALID_TYPES = ['flashcard', 'mcq', 'long'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MIN_COUNT = 3;
const MAX_COUNT = 20;
const MIN_NOTES_LENGTH = 30;
const MAX_NOTES_LENGTH = 12000; // chars (~3000 tokens, safe for every provider)

/** Returns { ok: true, value } or { ok: false, error }. */
function validateGenerateInput(body) {
  const { notes, type, count, difficulty } = body || {};

  if (typeof notes !== 'string' || notes.trim().length < MIN_NOTES_LENGTH) {
    return { ok: false, error: `Notes must be at least ${MIN_NOTES_LENGTH} characters.` };
  }
  if (!VALID_TYPES.includes(type)) {
    return { ok: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` };
  }
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return { ok: false, error: `count must be a whole number between ${MIN_COUNT} and ${MAX_COUNT}` };
  }
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return { ok: false, error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}` };
  }

  const value = {
    notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
    type,
    count,
    difficulty,
  };
  return { ok: true, value };
}

function quotaExceededMessage(limit) {
  return `You have reached your daily limit of ${limit} generations. Please try again tomorrow (UTC).`;
}

function createGenerateRoute({ callLLM, quotaStore, logger }) {
  return async function generateRoute(req, res, next) {
    const input = validateGenerateInput(req.body);
    if (!input.ok) {
      return res.status(400).json({ error: input.error });
    }

    const { uid } = req.user;
    let quota;
    try {
      quota = await quotaStore.tryConsume(uid);
    } catch (err) {
      return next(err);
    }
    if (!quota.allowed) {
      return res.status(429).json({ error: quotaExceededMessage(quota.limit) });
    }

    try {
      const { notes, type, count, difficulty } = input.value;
      const systemPrompt = buildSystemPrompt(type);
      const userPrompt = buildUserPrompt(type, count, difficulty, notes);
      const { result, provider } = await callLLM({ systemPrompt, userPrompt, type, count });

      return res.json({
        questions: result.questions,
        subject: result.subject || null,
        provider,
      });
    } catch (err) {
      await refundQuietly(quotaStore, uid, logger);
      if (err.details) {
        // All providers failed: details are logged here, never sent to the browser.
        logger.error(`[generate] ${err.message}: ${err.details.join(' | ')}`);
        return res.status(502).json({ error: 'Generation failed. Please try again.' });
      }
      return next(err);
    }
  };
}

async function refundQuietly(quotaStore, uid, logger) {
  try {
    await quotaStore.refund(uid);
  } catch (err) {
    logger.error(`[quota] refund failed: ${err.message}`);
  }
}

module.exports = {
  createGenerateRoute,
  validateGenerateInput,
  MAX_NOTES_LENGTH,
};
