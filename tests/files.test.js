const test = require('node:test');
const assert = require('node:assert/strict');
const files = require('../public/js/files');

test('PDF, DOCX and TXT are supported, in any letter case', () => {
  assert.equal(files.isSupportedFile('notes.PDF'), true);
  assert.equal(files.isSupportedFile('notes.docx'), true);
  assert.equal(files.isSupportedFile('notes.txt'), true);
});

test('old .doc files are not supported (Mammoth only reads .docx)', () => {
  assert.equal(files.isSupportedFile('old.doc'), false);
  assert.match(files.unsupportedFileMessage('old.doc'), /\.docx/);
});

test('other files and names without an extension are rejected', () => {
  assert.equal(files.isSupportedFile('photo.png'), false);
  assert.equal(files.isSupportedFile('README'), false);
});

test('the file input accept attribute matches the supported list', () => {
  assert.equal(files.ACCEPT_ATTRIBUTE, '.pdf,.docx,.txt');
});

test('trimmed files produce a notice with the share used', () => {
  const notice = files.trimmedDocsNotice([{ name: 'a.pdf', percentKept: 40 }]);
  assert.match(notice, /"a\.pdf" \(40% used\)/);
  assert.equal(files.trimmedDocsNotice([]), null);
});

test('skipped PDF pages produce a notice', () => {
  const notice = files.skippedPagesNotice({ name: 'big.pdf', pagesRead: 30, totalPages: 45 });
  assert.match(notice, /first 30 of 45 pages/);
  assert.match(notice, /big\.pdf/);
  assert.equal(files.skippedPagesNotice({ name: 'small.pdf', pagesRead: 5, totalPages: 5 }), null);
});
