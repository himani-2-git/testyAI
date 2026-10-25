const { validate } = require('../schemas');

const ENDPOINTS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
};

// Order = priority. Entries without a key are skipped, not "failed".
const PROVIDERS = [
  { name: 'groq-primary',   url: ENDPOINTS.groq,     model: 'openai/gpt-oss-120b', key: () => process.env.GROQ_API_KEY },
  { name: 'groq-secondary', url: ENDPOINTS.groq,     model: process.env.GROQ_FALLBACK_MODEL || 'qwen/qwen3-32b',
    key: () => process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY },
  { name: 'cerebras',       url: ENDPOINTS.cerebras, model: 'llama-3.3-70b',       key: () => process.env.CEREBRAS_API_KEY },
];

const TOKENS_PER_ITEM = { flashcard: 120, mcq: 220, long: 420 };

async function callProvider(p, { systemPrompt, userPrompt, type, count }) {
  const res = await fetch(p.url, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.7,
      // Scale with the request: a flat 4096 truncates 20 long answers mid-JSON.
      max_tokens: Math.min(8192, 400 + count * TOKENS_PER_ITEM[type]),
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const content = (await res.json())?.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty response');
  return JSON.parse(content);
}

async function callWithFallback(args) {
  const failures = [];
  for (const p of PROVIDERS.filter(p => p.key())) {
    try {
      const result = await callProvider(p, args);
      const check = validate(args.type, result);
      if (!check.valid) throw new Error(`schema: ${check.error}`);
      return { result, provider: p.name };
    } catch (err) {
      failures.push(`${p.name}: ${err.status || ''} ${err.message}`.trim());
      console.warn(`[ai] ${p.name} failed: ${err.message}`);
    }
  }
  const e = new Error('All AI providers failed');
  e.details = failures;           // logged server-side only, never sent to the client
  throw e;
}

module.exports = { callWithFallback };
