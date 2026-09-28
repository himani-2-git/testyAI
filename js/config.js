const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXlabeJKQZbCiCVINUEWVNyQV6wZhZ_Qg",
  authDomain: "testy-ai-7836e.firebaseapp.com",
  projectId: "testy-ai-7836e",
  storageBucket: "testy-ai-7836e.firebasestorage.app",
  messagingSenderId: "130257425668",
  appId: "1:130257425668:web:e6cedac91e9609455eac51"
};

// ── Initialize Firebase ──
firebase.initializeApp(FIREBASE_CONFIG);
 
// ── Firebase services ──
const auth = firebase.auth();
const db   = firebase.firestore();
 
// Offline support
db.enablePersistence().catch(() => {});
 
// ── Google login provider ──
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
// 🤖 AI CONFIG — Server-side (Groq primary / Cerebras fallback)
// API keys live in .env on the server. Nothing is exposed here.
// ============================================================

/**
 * callAI — sends generation params to the server-side /api/generate
 * endpoint which handles prompt-building, AI calls, and validation.
 *
 * @param {string} notes      - Extracted text from the uploaded file
 * @param {string} type       - 'flashcard' | 'mcq' | 'long'
 * @param {number} count      - Number of questions to generate
 * @param {string} difficulty - 'Easy' | 'Medium' | 'Hard'
 * @returns {Promise<Array>}  - Validated array of question objects
 */
async function callAI(notes, type, count, difficulty) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, type, count, difficulty })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Generation failed. Please try again.');
  }

  if (!Array.isArray(data.questions) || !data.questions.length) {
    throw new Error('Server returned empty questions. Please try again.');
  }

  if (data.subject) {
    data.questions.forEach(q => { if (!q.subject) q.subject = data.subject; });
    data.questions.detectedSubject = data.subject;
  }

  return data.questions;
}

// ============================================================
// 👤 CREATE USER PROFILE ON LOGIN
// ============================================================

auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  try {
    await createOrUpdateUser(user);
    console.log("User profile ready ✅");
  } catch (e) {
    console.error("Profile creation failed ❌", e);
  }
});