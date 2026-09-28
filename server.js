// ============================================================
//  server.js  — testyAI Express Server
//
//  Serves all static files (HTML/CSS/JS) AND the /api/generate
//  endpoint from a single process. API keys live in .env and
//  are never sent to the browser.
// ============================================================

require('dotenv').config();

const express = require('express');
const path    = require('path');

const generateRoute = require('./api/generate');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──
app.use(express.json({ limit: '2mb' }));

// ── API routes (must be declared BEFORE static middleware) ──
app.post('/api/generate', generateRoute);

// ── Serve static frontend files ──
app.use(express.static(path.join(__dirname)));

// ── SPA fallback: send index.html for any unmatched route ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n🚀 testyAI running at http://localhost:${PORT}`);
  console.log(`   AI:  Groq (primary) → Cerebras (fallback)`);
  console.log(`   Auth: Firebase (unchanged)\n`);
});
