// Tiny UI helper shared by every page.
// Icons are Google's Material Symbols (Apache-2.0): https://fonts.google.com/icons
// `name` must always be a hard-coded literal, never user input, because the result is inserted as HTML.
function icon(name, extraClass = '') {
  return `<span class="ms${extraClass ? ' ' + extraClass : ''}" aria-hidden="true">${name}</span>`;
}
