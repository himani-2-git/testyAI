// ============================================================
//  js/db.js — All Firestore Database Operations
//  Requires config.js to be loaded first (auth, db globals)
// ============================================================

// ============================================================
//  USER PROFILE
// ============================================================

/**
 * Creates user profile on first login; updates streak on return.
 * Called right after successful auth.
 */
async function createOrUpdateUser(firebaseUser) {
  const ref = db.collection('users').doc(firebaseUser.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // Brand new user
    await ref.set({
      uid:                  firebaseUser.uid,
      email:                firebaseUser.email || '',
      displayName:          firebaseUser.displayName || 'Student',
      photoURL:             firebaseUser.photoURL || '',
      createdAt:            firebase.firestore.FieldValue.serverTimestamp(),
      currentStreak:        1,
      longestStreak:        1,
      lastActiveDate:       localDateStr(),
      totalTests:           0,
      totalQuestionsAnswered: 0,
      totalCorrect:         0
    });
    return { isNew: true };
  } else {
    // Returning user — update streak
    await _updateStreak(firebaseUser.uid, snap.data());
    return { isNew: false };
  }
}

async function getUserProfile(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

// ============================================================
//  STREAK SYSTEM
// ============================================================

/**
 * Internal streak updater.
 * Consecutive day = +1 streak. Gap > 1 day = reset to 1.
 */
async function _updateStreak(uid, profileData) {
  const next = nextStreak(profileData, localDateStr());
  if (next.lastActiveDate === profileData.lastActiveDate) return;   // already counted today
  await db.collection('users').doc(uid).update(next);
}

/** Call this after a user completes/generates a test (ensures streak counts activity) */
async function touchStreak(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists) await _updateStreak(uid, snap.data());
}

// ============================================================
//  SAVE TEST
// ============================================================

/**
 * Saves a newly generated test to Firestore.
 * Returns the new testId.
 *
 * testData shape:
 *   { title, type, difficulty, questions, topics }
 *
 * For MCQ, each question should have: { question, options, answer, explanation, topic }
 * For flashcard: { front, back, topic }
 * For long: { question, answer, keyPoints, marks, topic }
 */
async function saveTest(uid, testData) {
  const { title, subject, type, difficulty, questions, topics } = testData;

  const docRef = await db.collection('tests').add({
    userId:        uid,
    title:         (title || 'Untitled Test').slice(0, 100),
    subject:       subject || 'General',
    type,                        // 'mcq' | 'flashcard' | 'long'
    difficulty:    difficulty || 'Medium',
    questionCount: questions.length,
    questions,                   // full array of question objects
    topics:        topics || [], // array of topic strings
    attempted:     false,
    score:         null,         // null until MCQ is attempted
    scorePercent:  null,
    userAnswers:   {},           // filled in on attempt
    createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    attemptedAt:   null
  });

  return docRef.id;
}

// ============================================================
//  SAVE MCQ ATTEMPT (after user submits answers)
// ============================================================

/**
 * Saves an MCQ attempt, updates analytics and user totals.
 *
 * attemptData shape:
 *   { userAnswers, correctCount, totalQ, topicResults }
 *
 * topicResults: { "Network Layer": { correct: 3, total: 5 }, ... }
 */
async function saveMCQAttempt(uid, testId, { userAnswers, correctCount, totalQ, topicResults }) {
  const scorePercent = Math.round((correctCount / totalQ) * 100);
  const FV = firebase.firestore.FieldValue;
  const testRef = db.collection('tests').doc(testId);
  const userRef = db.collection('users').doc(uid);
  const statsRef = db.collection('analytics').doc(uid);

  // One transaction: either the whole attempt is recorded or none of it is.
  await db.runTransaction(async tx => {
    const [userSnap, statsSnap] = await Promise.all([tx.get(userRef), tx.get(statsRef)]);
    const stats = statsSnap.exists ? statsSnap.data() : { topicPerformance: {}, recentScores: [] };
    const entry = { testId, score: scorePercent, date: localDateStr(), ts: Date.now() };

    tx.update(testRef, { attempted: true, score: correctCount, scorePercent, userAnswers, attemptedAt: FV.serverTimestamp() });
    tx.update(userRef, {
      totalTests: FV.increment(1),
      totalQuestionsAnswered: FV.increment(totalQ),
      totalCorrect: FV.increment(correctCount),
      ...nextStreak(userSnap.data(), localDateStr()),
    });
    tx.set(statsRef, {
      topicPerformance: mergeTopicPerf(stats.topicPerformance, topicResults),
      recentScores: [entry, ...(stats.recentScores || [])].slice(0, 20),
    });
  });
  return scorePercent;
}

// ============================================================
//  ANALYTICS (writes happen inside saveMCQAttempt's transaction)
// ============================================================

async function getUserAnalytics(uid) {
  const snap = await db.collection('analytics').doc(uid).get();
  return snap.exists
    ? snap.data()
    : { topicPerformance: {}, recentScores: [] };
}

// ============================================================
//  TEST HISTORY
// ============================================================

async function getUserTests(uid, limitN = 15) {
  const snap = await db.collection('tests')
    .where('userId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limitN)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getTest(testId) {
  const snap = await db.collection('tests').doc(testId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function deleteTest(testId) {
  await db.collection('tests').doc(testId).delete();
}

// ============================================================
//  SMART FEEDBACK HELPERS (run client-side)
// ============================================================

/**
 * Builds topic-level result from MCQ submission.
 * questions: array of question objects with .topic and optional .subject field
 * userAnswers: { index: selectedLetter }
 * defaultSubject: optional fallback subject string
 * Returns topicResults map.
 */
function computeTopicResults(questions, userAnswers, defaultSubject = 'General') {
  const topicResults = {};
  questions.forEach((q, i) => {
    const subject = q.subject || defaultSubject || 'General';
    const subTopic = q.topic || 'General';
    const key = `${subject} • ${subTopic}`;
    if (!topicResults[key]) {
      topicResults[key] = { subject, cleanTopic: subTopic, correct: 0, total: 0 };
    }
    topicResults[key].total += 1;
    if (userAnswers[i] === q.answer) topicResults[key].correct += 1;
  });
  return topicResults;
}

/** Overall accuracy across all time (%) */
function overallAccuracy(userProfile) {
  const { totalCorrect = 0, totalQuestionsAnswered = 0 } = userProfile;
  if (totalQuestionsAnswered === 0) return 0;
  return Math.round((totalCorrect / totalQuestionsAnswered) * 100);
}

// ============================================================
//  UTILITY HELPERS
// ============================================================

/** Format a Firestore Timestamp or Date for display */
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Grade label from score percent */
function gradeFromScore(pct) {
  if (pct >= 90) return { label: 'Outstanding 🏆', color: 'var(--green)' };
  if (pct >= 75) return { label: 'Great Job 🎯',   color: 'var(--green)' };
  if (pct >= 60) return { label: 'Good Effort 📗',  color: 'var(--amber)' };
  if (pct >= 40) return { label: 'Keep Going 📚',   color: 'var(--amber)' };
  return             { label: 'Needs Work 💪',       color: 'var(--tiger)' };
}