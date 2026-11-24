// Builds the dashboard's HTML strings. Loaded by the browser AND by `node --test`.
//
// Security rules used everywhere in this file:
//  - Every value from Firestore or the AI goes through escapeHtml().
//  - No inline event handlers (onclick="..."). Values go into data-*
//    attributes and dashboard.html listens for clicks on the container.
//    (Escaping is not enough inside onclick: the browser decodes &#39;
//    back to ' before running the code.)
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { icon, escapeHtml } = isNode ? require('./ui') : root;
  const { WEAK_BELOW, STRONG_FROM } = isNode ? require('./analytics') : root;

  const TEST_TYPES = ['mcq', 'flashcard', 'long'];
  const TYPE_ICONS = { mcq: 'quiz', flashcard: 'style', long: 'edit_note' };

  const SUBJECT_ABBREVIATIONS = {
    'Machine Learning': 'ML',
    'Artificial Intelligence': 'AI',
    'Computer Science': 'CS',
    English: 'ENG',
    Mathematics: 'MATH',
    Physics: 'PHYS',
    Chemistry: 'CHEM',
    Biology: 'BIO',
    History: 'HIST',
  };

  function subjectTagClass(subject) {
    if (/machine|ml|ai/i.test(subject)) return 'subj-ml';
    if (/english|eng|grammar/i.test(subject)) return 'subj-eng';
    if (/math/i.test(subject)) return 'subj-math';
    if (/physics|phys|chem|bio/i.test(subject)) return 'subj-sci';
    return 'subj-gen';
  }

  function subjectTagHtml(subject) {
    if (!subject || subject === 'General') return '';
    const fallback = subject.length > 7 ? subject.slice(0, 5) + '.' : subject;
    const abbreviation = SUBJECT_ABBREVIATIONS[subject] || fallback;
    return `<span class="subj-tag ${subjectTagClass(subject)}" title="${escapeHtml(subject)}">${escapeHtml(abbreviation)}</span>`;
  }

  function subjectChipsHtml({ subjects, topicCounts, totalCount, activeSubject }) {
    const allActive = activeSubject === 'all' ? 'active' : '';
    const allChip = `<button type="button" class="subj-chip ${allActive}" data-subject-all="true">${icon('public')} All Subjects (${Number(totalCount) || 0})</button>`;
    const subjectChips = subjects.map((subject) => {
      const active = activeSubject === subject ? 'active' : '';
      const count = Number(topicCounts[subject]) || 0;
      return `<button type="button" class="subj-chip ${active}" data-subject="${escapeHtml(subject)}">${escapeHtml(subject)} (${count})</button>`;
    });
    return allChip + subjectChips.join('');
  }

  function topicRowsHtml(topics, { kind, showSubjectTag }) {
    return topics.map((t) => {
      const tag = showSubjectTag && t.subject && t.subject !== 'General' ? subjectTagHtml(t.subject) : '';
      const accuracy = Number(t.accuracy) || 0;
      return `
        <div class="topic-row ${kind === 'weak' ? 'weak' : 'strong'}">
          <div class="topic-label" title="${escapeHtml(t.subject)} - ${escapeHtml(t.topic)}">${tag}<span class="topic-name">${escapeHtml(t.topic)}</span></div>
          <div class="topic-bar-wrap"><div class="topic-bar" style="width:${accuracy}%"></div></div>
          <div class="topic-pct">${accuracy}%</div>
        </div>`;
    }).join('');
  }

  function weakTopicFeedbackHtml(weakTopics, { showSubjectTag }) {
    return weakTopics.slice(0, 3).map((t) => {
      const tag = showSubjectTag && t.subject && t.subject !== 'General' ? subjectTagHtml(t.subject) + ' ' : '';
      const accuracy = Number(t.accuracy) || 0;
      const topic = `<strong>${escapeHtml(t.topic)}</strong>`;
      if (accuracy < 40) return `${icon('warning')} ${tag}${topic} — only ${accuracy}% accuracy. Revisit the basics.`;
      return `${icon('menu_book')} ${tag}${topic} — ${accuracy}%. Practice more questions on this topic.`;
    }).join('<br>');
  }

  function noWeakTopicsMessage(subjectFilter) {
    if (subjectFilter === 'all') return `No weak areas below ${WEAK_BELOW}% accuracy.`;
    return `No weak areas in ${escapeHtml(subjectFilter)}. All topics are at ${WEAK_BELOW}% or above.`;
  }

  function noStrongTopicsMessage(subjectFilter) {
    if (subjectFilter === 'all') return `Score ${STRONG_FROM}% or more on a topic to see it here.`;
    return `Score ${STRONG_FROM}% or more on a ${escapeHtml(subjectFilter)} topic to see it here.`;
  }

  function scoreColor(score) {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--amber)';
    return 'var(--tiger)';
  }

  function chartHtml(scores) {
    const recent = scores.slice(0, 10).reverse(); // oldest first
    const bars = recent.map((s) => {
      const score = Math.max(0, Math.min(100, Number(s.score) || 0));
      const height = Math.max(6, Math.round((score / 100) * 86));
      const color = scoreColor(score);
      const date = typeof s.date === 'string' ? s.date.slice(5) : ''; // MM-DD
      return `<div class="chart-bar-wrap">
      <div class="chart-val" style="color:${color}">${score}%</div>
      <div class="chart-bar" style="height:${height}px;background:${color}"></div>
      <div class="chart-date">${escapeHtml(date)}</div>
    </div>`;
    });
    return `<div class="chart-bars">${bars.join('')}</div>`;
  }

  function historyScoreHtml(scorePercent) {
    if (scorePercent === null || scorePercent === undefined) return '<span class="hist-score na">—</span>';
    const score = Number(scorePercent) || 0;
    let cls = 'bad';
    if (score >= 75) cls = 'good';
    else if (score >= 50) cls = 'mid';
    return `<span class="hist-score ${cls}">${score}%</span>`;
  }

  function historyDate(createdAt) {
    if (!createdAt || typeof createdAt.toDate !== 'function') return '—';
    return createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function historyItemsHtml(tests) {
    return tests.map((t) => {
      const type = TEST_TYPES.includes(t.type) ? t.type : 'unknown';
      return `<div class="hist-item">
      <div class="hist-icon ${type}">${icon(TYPE_ICONS[type] || 'description')}</div>
      <div class="hist-info">
        <div class="hist-title">${escapeHtml(t.title || 'Untitled')}</div>
        <div class="hist-meta">${Number(t.questionCount) || 0} Qs · ${escapeHtml(t.difficulty || 'Medium')} · ${escapeHtml(historyDate(t.createdAt))}</div>
      </div>
      <span class="hist-tag ${type}">${escapeHtml(type.toUpperCase())}</span>
      ${historyScoreHtml(t.scorePercent)}
      <button type="button" class="delete-btn" data-test-id="${escapeHtml(t.id)}" title="Delete" aria-label="Delete test">${icon('delete')}</button>
    </div>`;
    }).join('');
  }

  const api = {
    subjectChipsHtml,
    topicRowsHtml,
    weakTopicFeedbackHtml,
    noWeakTopicsMessage,
    noStrongTopicsMessage,
    chartHtml,
    historyItemsHtml,
  };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
