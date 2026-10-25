require('dotenv').config();

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const generateRoute = require('./api/generate');

const app = express();
const PORT = process.env.PORT || 8080;
app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs

app.use(express.json({ limit: '2mb' }));

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,                       // 20 generations / hour / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

app.post('/api/generate', generateLimiter, generateRoute);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Only /public is web-visible. Server code, rules and package files are not.
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`testyAI listening on :${PORT}`));
