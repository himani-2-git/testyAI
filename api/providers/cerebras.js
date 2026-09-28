// ============================================================
//  api/providers/cerebras.js
//  Cerebras provider — FALLBACK
//
//  Uses the OpenAI-compatible Cerebras Inference API.
//  Cerebras supports response_format: { type: "json_object" }
//  which enables JSON mode (forces valid JSON output).
//  We then validate the result against our schema server-side.
//
//  Docs: https://inference-docs.cerebras.ai/api-reference/chat
// ============================================================

const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_MODEL    = 'llama-3.3-70b';

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<object>}   - Parsed JSON object from the model
 */
async function callCerebras(systemPrompt, userPrompt) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not set in environment');

  const res = await fetch(CEREBRAS_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      temperature: 0.7,
      max_tokens:  4096,
      // ── JSON mode ──
      // Guarantees the model output is parseable JSON.
      // Schema conformance is validated in api/schemas.js after parsing.
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Cerebras HTTP ${res.status}`;
    const error = new Error(msg);
    error.provider = 'cerebras';
    throw error;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Cerebras returned empty content');

  // Cerebras json_object mode guarantees parseable JSON
  return JSON.parse(content);
}

module.exports = { callCerebras };
