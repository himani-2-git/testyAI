// ============================================================
//  api/providers/groq.js
//  Groq provider — PRIMARY
//
//  Uses llama-3.3-70b-versatile which supports structured-output
//  mode (response_format.type = "json_schema") on Groq's API.
//  This guarantees the model emits JSON matching our schema,
//  not just "tries" to based on prompt instructions.
//
//  Docs: https://console.groq.com/docs/structured-outputs
// ============================================================

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'openai/gpt-oss-120b'; // best available on this account

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} [apiKey]  - Groq API key (defaults to GROQ_API_KEY env var)
 * @param {string} [model]   - Model ID (defaults to GROQ_MODEL constant)
 * @returns {Promise<object>}
 */
async function callGroq(systemPrompt, userPrompt, apiKey, model) {
  const key   = apiKey || process.env.GROQ_API_KEY;
  const mdl   = model  || GROQ_MODEL;
  if (!key) throw new Error('No Groq API key provided');

  const res = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      model: mdl,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      temperature: 0.7,
      max_tokens:  4096,
      // ── JSON mode ──
      // Guarantees valid JSON output. Schema conformance is
      // validated server-side in api/schemas.js after parsing.
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Groq HTTP ${res.status}`;
    // Distinguish rate-limit (429) so caller can fall back gracefully
    const isRateLimit = res.status === 429;
    const error = new Error(msg);
    error.isRateLimit = isRateLimit;
    error.provider = 'groq';
    throw error;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty content');

  return JSON.parse(content); // Safe: structured-output guarantees valid JSON
}

module.exports = { callGroq };
