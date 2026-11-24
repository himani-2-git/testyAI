// Upload rules and user notices. Loaded by the browser AND by `node --test`.
(function (root) {
  // .doc (old binary Word) is NOT here: Mammoth can only read .docx.
  const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt'];
  const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.map((ext) => '.' + ext).join(',');
  const MAX_PDF_PAGES = 30; // Phase 4 replaces this with proper chunking

  function getFileExtension(name) {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return '';
    return name.slice(dot + 1).toLowerCase();
  }

  function isSupportedFile(name) {
    return SUPPORTED_EXTENSIONS.includes(getFileExtension(name));
  }

  function unsupportedFileMessage(name) {
    if (getFileExtension(name) === 'doc') {
      return `"${name}" is an old Word .doc file. Please save it as .docx and upload it again.`;
    }
    return `"${name}" is not supported. Use PDF, DOCX or TXT.`;
  }

  /** Notice when a PDF had more pages than we read. Null when nothing was skipped. */
  function skippedPagesNotice({ name, pagesRead, totalPages }) {
    if (pagesRead >= totalPages) return null;
    return `Only the first ${pagesRead} of ${totalPages} pages of "${name}" were read.`;
  }

  /** Notice listing files that were cut to fit the notes limit. Null when nothing was cut. */
  function trimmedDocsNotice(trimmedDocs) {
    if (!trimmedDocs.length) return null;
    const parts = trimmedDocs.map((doc) => `"${doc.name}" (${doc.percentKept}% used)`);
    return `Your notes are longer than the current limit, so only the beginning of each file is used: ${parts.join(', ')}.`;
  }

  const api = {
    SUPPORTED_EXTENSIONS,
    ACCEPT_ATTRIBUTE,
    MAX_PDF_PAGES,
    getFileExtension,
    isSupportedFile,
    unsupportedFileMessage,
    skippedPagesNotice,
    trimmedDocsNotice,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
