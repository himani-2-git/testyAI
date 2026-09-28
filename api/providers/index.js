// ============================================================
//  api/providers/index.js
//  Provider abstraction layer — Groq (primary) → Cerebras (fallback)
//
//  This is the ONLY file that knows about provider internals.
//  Adding a new provider in future = add a file in this folder
//  and update the PROVIDERS array below. Zero UI or DB changes.
// ============================================================

const { callGroq } = require('./groq');

// ── Provider registry ──
// Add new providers here without touching any other file.
const PROVIDERS = [
  {
    name: 'groq-gpt-oss-120b',
    call: (systemPrompt, userPrompt) =>
      callGroq(systemPrompt, userPrompt, process.env.GROQ_API_KEY, 'openai/gpt-oss-120b')
  },
  {
    name: 'groq-qwen-27b',
    call: (systemPrompt, userPrompt) =>
      callGroq(systemPrompt, userPrompt, process.env.GROQ_API_KEY, 'qwen/qwen3.8-27b')
  }
  // To add a provider: { name: '...', call: (sys, usr) => yourProviderFn(...) }
];

/**
 * Calls providers in order. Falls back on:
 *   - Rate-limit errors (429)
 *   - Any thrown error from the current provider
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} type - 'mcq' | 'flashcard' | 'long'
 * @returns {{ result: object, provider: string }}
 */
async function callWithFallback(systemPrompt, userPrompt, type) {
  const errors = [];

  for (const provider of PROVIDERS) {
    try {
      console.log(`[AI] Trying provider: ${provider.name}`);
      const result = await provider.call(systemPrompt, userPrompt, type);
      console.log(`[AI] Success with provider: ${provider.name}`);
      return { result, provider: provider.name };
    } catch (err) {
      console.warn(`[AI] Provider "${provider.name}" failed: ${err.message}`);
      errors.push({ provider: provider.name, message: err.message });
      // Always fall through to next provider on any error
    }
  }

  // All providers failed
  const summary = errors.map(e => `${e.provider}: ${e.message}`).join(' | ');
  throw new Error(`All AI providers failed. ${summary}`);
}

module.exports = { callWithFallback };
