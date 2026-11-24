// Tiny UI helpers shared by every page. Loaded by the browser AND by `node --test`.
// Icons are Google's Material Symbols (Apache-2.0): https://fonts.google.com/icons
(function (root) {
  /**
   * `name` must always be a hard-coded literal, never user input or AI output,
   * because the result is inserted as HTML.
   */
  function icon(name, extraClass = '') {
    return `<span class="ms${extraClass ? ' ' + extraClass : ''}" aria-hidden="true">${name}</span>`;
  }

  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  /**
   * Makes any value safe to put inside HTML text or a quoted attribute.
   * Use it for EVERYTHING that comes from users, files, Firestore or the AI.
   * Never put such values inside onclick="..." — use data-* attributes instead.
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  }

  const api = { icon, escapeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
