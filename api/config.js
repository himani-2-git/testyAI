// ============================================================
//  api/config.js
//  Reads and checks environment variables once, at startup.
//  If anything is wrong the server refuses to start and lists
//  every problem at once. Secret values are never printed.
// ============================================================

const LLM_PROVIDERS = ['auto', 'mock'];
const DEFAULT_PORT = 8080;
const DEFAULT_DAILY_QUOTA = 30;
const REQUIRED_SERVICE_ACCOUNT_FIELDS = ['project_id', 'client_email', 'private_key'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function parsePositiveInteger(raw, fallback) {
  if (isBlank(raw)) return fallback;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return NaN;
  const number = Number(text);
  return number > 0 ? number : NaN;
}

function decodeServiceAccount(base64Value, problems) {
  if (isBlank(base64Value)) {
    problems.push('FIREBASE_SERVICE_ACCOUNT_BASE64 is missing. See .env.example for how to create it.');
    return null;
  }

  let parsed;
  try {
    const json = Buffer.from(String(base64Value).trim(), 'base64').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    problems.push('FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64-encoded JSON.');
    return null;
  }

  const missingFields = REQUIRED_SERVICE_ACCOUNT_FIELDS.filter((field) => isBlank(parsed?.[field]));
  if (missingFields.length) {
    problems.push(`FIREBASE_SERVICE_ACCOUNT_BASE64 is missing these fields: ${missingFields.join(', ')}.`);
    return null;
  }
  return parsed;
}

function parseAllowedOrigins(raw, port) {
  if (isBlank(raw)) return [`http://localhost:${port}`];
  return String(raw)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function loadConfig(env = process.env) {
  const problems = [];
  const isProduction = env.NODE_ENV === 'production';

  const port = parsePositiveInteger(env.PORT, DEFAULT_PORT);
  if (Number.isNaN(port)) problems.push('PORT must be a positive whole number.');

  const llmProvider = isBlank(env.LLM_PROVIDER) ? 'auto' : String(env.LLM_PROVIDER).trim();
  if (!LLM_PROVIDERS.includes(llmProvider)) {
    problems.push(`LLM_PROVIDER must be one of: ${LLM_PROVIDERS.join(', ')}.`);
  }
  if (llmProvider === 'mock' && isProduction) {
    problems.push('LLM_PROVIDER=mock is not allowed in production.');
  }
  const hasAnyLLMKey = !isBlank(env.GROQ_API_KEY) || !isBlank(env.CEREBRAS_API_KEY);
  if (llmProvider === 'auto' && !hasAnyLLMKey) {
    problems.push('Set GROQ_API_KEY or CEREBRAS_API_KEY (or LLM_PROVIDER=mock for local testing).');
  }

  const dailyGenerationQuota = parsePositiveInteger(env.DAILY_GENERATION_QUOTA, DEFAULT_DAILY_QUOTA);
  if (Number.isNaN(dailyGenerationQuota)) {
    problems.push('DAILY_GENERATION_QUOTA must be a positive whole number.');
  }

  if (isProduction && isBlank(env.ALLOWED_ORIGINS)) {
    problems.push('ALLOWED_ORIGINS is required in production (for example https://testyai.onrender.com).');
  }
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS, Number.isNaN(port) ? DEFAULT_PORT : port);

  const firebaseServiceAccount = decodeServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_BASE64, problems);

  if (problems.length) {
    const list = problems.map((problem) => `  - ${problem}`).join('\n');
    throw new Error(`Invalid configuration:\n${list}`);
  }

  return {
    port,
    isProduction,
    llmProvider,
    dailyGenerationQuota,
    allowedOrigins,
    firebaseServiceAccount,
    firebaseAuthDomain: `${firebaseServiceAccount.project_id}.firebaseapp.com`,
  };
}

module.exports = { loadConfig };
