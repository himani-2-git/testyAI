// Entry point: load config, connect to Firebase, start the server.
require('dotenv').config({ quiet: true });

const { loadConfig } = require('./api/config');
const { initFirebaseAdmin } = require('./api/firebaseAdmin');
const { createFirestoreQuotaStore } = require('./api/quota');
const { selectLLMCaller } = require('./api/providers');
const { createApp } = require('./api/createApp');

function loadConfigOrExit() {
  try {
    return loadConfig(process.env);
  } catch (err) {
    console.error(err.message);
    console.error('The server did not start. Fix the settings above in .env (local) or the Render dashboard.');
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const firebase = initFirebaseAdmin(config.firebaseServiceAccount);

const app = createApp({
  verifyIdToken: firebase.verifyIdToken,
  quotaStore: createFirestoreQuotaStore({ db: firebase.db, limit: config.dailyGenerationQuota }),
  callLLM: selectLLMCaller(config.llmProvider),
  allowedOrigins: config.allowedOrigins,
  firebaseAuthDomain: config.firebaseAuthDomain,
});

app.listen(config.port, () => {
  console.log(`testyAI listening on :${config.port} (LLM: ${config.llmProvider}, daily quota: ${config.dailyGenerationQuota})`);
});
