// Pure functions: no Firebase, no DOM. Loaded by the browser AND by `node --test`.
(function (root) {
  const WEAK_BELOW = 60;     // < 60%  -> needs work
  const STRONG_FROM = 75;    // >= 75% -> strength. 60-74% is "developing": in neither list.

  /** Local calendar date (YYYY-MM-DD). toISOString() is UTC and breaks streaks for IST users. */
  function localDateStr(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Whole calendar days between two YYYY-MM-DD strings (DST-safe: compares UTC midnights). */
  function daysBetween(a, b) {
    if (!a || !b) return Infinity;
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }

  function nextStreak({ currentStreak = 0, longestStreak = 0, lastActiveDate }, today) {
    if (lastActiveDate === today) return { currentStreak, longestStreak, lastActiveDate };
    const gap = daysBetween(lastActiveDate, today);
    const streak = gap === 1 ? currentStreak + 1 : 1;
    return { currentStreak: streak, longestStreak: Math.max(longestStreak, streak), lastActiveDate: today };
  }

  /** topicPerformance: { "Subject • Topic": { subject, cleanTopic, correct, total } } */
  function rankTopics(topicPerformance, { subject = 'all', predicate, order, limit = 6 }) {
    return Object.entries(topicPerformance)
      .map(([key, d]) => ({
        key,
        subject: d.subject || 'General',   // the model already tags every question; no regex guessing
        topic: d.cleanTopic || key,
        total: d.total || 0,
        correct: d.correct || 0,
        accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0,
      }))
      .filter(t => t.total > 0 && predicate(t.accuracy))
      .filter(t => subject === 'all' || t.subject.toLowerCase() === subject.toLowerCase())
      .sort((a, b) => order * (a.accuracy - b.accuracy))
      .slice(0, limit);
  }

  const getWeakTopics   = (perf, subject) => rankTopics(perf, { subject, predicate: a => a < WEAK_BELOW,  order: 1 });
  const getStrongTopics = (perf, subject) => rankTopics(perf, { subject, predicate: a => a >= STRONG_FROM, order: -1 });

  /** Split a character budget evenly across documents so no file is silently dropped. */
  function buildNotes(docs, budget = 12000) {
    if (!docs.length) return '';
    const per = Math.floor(budget / docs.length);
    return docs
      .map(({ name, text }) => `=== DOCUMENT: ${name} ===\n${text.trim().slice(0, per)}`)
      .join('\n\n');
  }

  /** Merge one attempt into stored stats. Keeps subject/cleanTopic (the old merge dropped them). */
  function mergeTopicPerf(existing = {}, results = {}) {
    const out = { ...existing };
    for (const [key, r] of Object.entries(results)) {
      const prev = out[key] || { subject: r.subject, cleanTopic: r.cleanTopic, correct: 0, total: 0 };
      out[key] = { ...prev, correct: prev.correct + r.correct, total: prev.total + r.total };
    }
    return out;
  }

  const api = { mergeTopicPerf, localDateStr, daysBetween, nextStreak, getWeakTopics, getStrongTopics, buildNotes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
