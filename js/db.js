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
      lastActiveDate:       _todayStr(),
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
  const today = _todayStr();
  const last  = profileData.lastActiveDate || '';

  if (last === today) return; // already updated today — no-op

  const diff = _daysDiff(last, today);
  let streak  = profileData.currentStreak || 1;
  let longest = profileData.longestStreak || 1;

  if (diff === 1) {
    streak += 1;           // keep it going 🔥
  } else if (diff > 1) {
    streak = 1;            // streak broken
  }
  longest = Math.max(longest, streak);

  await db.collection('users').doc(uid).update({
    currentStreak:  streak,
    longestStreak:  longest,
    lastActiveDate: today
  });
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
async function saveMCQAttempt(uid, testId, attemptData) {
  const { userAnswers, correctCount, totalQ, topicResults } = attemptData;
  const scorePercent = Math.round((correctCount / totalQ) * 100);

  // 1. Mark test as attempted
  await db.collection('tests').doc(testId).update({
    attempted:    true,
    score:        correctCount,
    scorePercent,
    userAnswers,
    attemptedAt:  firebase.firestore.FieldValue.serverTimestamp()
  });

  // 2. Bump user aggregate stats
  await db.collection('users').doc(uid).update({
    totalTests:             firebase.firestore.FieldValue.increment(1),
    totalQuestionsAnswered: firebase.firestore.FieldValue.increment(totalQ),
    totalCorrect:           firebase.firestore.FieldValue.increment(correctCount)
  });

  // 3. Update topic-level analytics
  await _updateAnalytics(uid, { testId, scorePercent, topicResults });

  // 4. Touch streak (they were active today)
  await touchStreak(uid);

  return scorePercent;
}

// ============================================================
//  ANALYTICS
// ============================================================

async function _updateAnalytics(uid, { testId, scorePercent, topicResults }) {
  const ref  = db.collection('analytics').doc(uid);
  const snap = await ref.get();

  const scoreEntry = {
    testId,
    score: scorePercent,
    date:  _todayStr(),
    ts:    Date.now()
  };

  if (!snap.exists) {
    const topicPerf = _buildTopicPerf({}, topicResults);
    await ref.set({
      topicPerformance: topicPerf,
      recentScores:     [scoreEntry]
    });
  } else {
    const old = snap.data();

    // Keep only last 20 scores
    const recentScores = [scoreEntry, ...(old.recentScores || [])].slice(0, 20);

    // Merge topic performance
    const topicPerf = _buildTopicPerf(old.topicPerformance || {}, topicResults);

    await ref.update({ topicPerformance: topicPerf, recentScores });
  }
}

function _buildTopicPerf(existing, newResults) {
  const merged = { ...existing };
  if (!newResults) return merged;
  for (const [topic, { correct, total }] of Object.entries(newResults)) {
    if (!merged[topic]) merged[topic] = { correct: 0, total: 0 };
    merged[topic].correct += correct;
    merged[topic].total   += total;
  }
  return merged;
}

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

function inferSubjectFromTopicOrTitle(str) {
  if (!str) return 'General';
  if (str.includes('•')) {
    const s = str.split('•')[0].trim();
    if (s && s !== 'General') return s;
    str = str.split('•')[1]?.trim() || str;
  }
  const s = str.toLowerCase();
  if (/machine\s*learning|tensorflow|scikit|keras|deep\s*learning|neural|gradient|regression|classification|svm|random\s*forest|dimension|pca|cluster|paradigm|dataset|feature|vector|algorithm|epoch|loss|unsupervised|supervised|reinforcement|overfitting|underfitting|hyperparameter/i.test(s)) {
    return 'Machine Learning';
  }
  if (/english|grammar|literature|comprehension|article|speech|tense|punctuation|conjunction|preposition|verb|noun|adjective|adverb|pronoun|clause|sentence|vocabulary|idiom|syntax|passive|active\s*voice/i.test(s)) {
    return 'English';
  }
  if (/math|calculus|algebra|geometry|matrix|derivative|integral|probability|statistic|arithmetic|trigonometry|transformation/i.test(s)) {
    return 'Mathematics';
  }
  if (/physics|mechanics|thermo|kinematics|optics|electromagnet/i.test(s)) return 'Physics';
  if (/chemistry|organic|inorganic|periodic|molecule|compound|reaction/i.test(s)) return 'Chemistry';
  if (/biology|cells|genetics|dna|evolution|organism|botany|zoology/i.test(s)) return 'Biology';
  if (/history|revolution|empire|civilization|war|treaty/i.test(s)) return 'History';
  if (/computer\s*science|programming|python|javascript|coding|data\s*structure|network/i.test(s)) return 'Computer Science';
  return 'General';
}

/**
 * Returns weakest topics (accuracy < 75%).
 * Allows filtering by subject if requested.
 */
function getWeakTopics(topicPerformance, subjectFilter = 'all') {
  return Object.entries(topicPerformance)
    .map(([key, data]) => {
      const correct = data?.correct || 0;
      const total   = data?.total   || 0;
      const subject = data?.subject || inferSubjectFromTopicOrTitle(key);
      const cleanTopic = data?.cleanTopic || (key.includes('•') ? key.split('•')[1].trim() : key);
      return {
        key,
        subject,
        topic: cleanTopic,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        total,
        correct
      };
    })
    .filter(t => t.total >= 1 && t.accuracy < 75)
    .filter(t => subjectFilter === 'all' || t.subject.toLowerCase() === subjectFilter.toLowerCase())
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6);
}

/**
 * Returns strongest topics (accuracy >= 60%).
 * Allows filtering by subject if requested.
 */
function getStrongTopics(topicPerformance, subjectFilter = 'all') {
  return Object.entries(topicPerformance)
    .map(([key, data]) => {
      const correct = data?.correct || 0;
      const total   = data?.total   || 0;
      const subject = data?.subject || inferSubjectFromTopicOrTitle(key);
      const cleanTopic = data?.cleanTopic || (key.includes('•') ? key.split('•')[1].trim() : key);
      return {
        key,
        subject,
        topic: cleanTopic,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        total,
        correct
      };
    })
    .filter(t => t.total >= 1 && t.accuracy >= 60)
    .filter(t => subjectFilter === 'all' || t.subject.toLowerCase() === subjectFilter.toLowerCase())
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 6);
}

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
    let subject = q.subject || defaultSubject || 'General';
    if (!subject || subject === 'General') {
      subject = inferSubjectFromTopicOrTitle(q.topic);
      if (!subject || subject === 'General') {
        subject = defaultSubject || 'General';
      }
    }
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

function _todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function _daysDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 999;
  const ms = new Date(dateStr2) - new Date(dateStr1);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

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