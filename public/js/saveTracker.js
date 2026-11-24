// Tracks the background "save test to Firestore" call.
// Loaded by the browser AND by `node --test`.
//
// Bug it fixes: the page saved the test in the background and, if the user
// clicked "Check Answers" before that save finished (or it failed), the
// score was silently NOT saved. Now "Check Answers" waits for the save,
// retries it once if it failed, and only then records the attempt.
(function (root) {
  function createSaveTracker(saveFn) {
    let pending = null;
    let lastData = null;

    function begin(data) {
      const promise = saveFn(data);
      // Avoid "unhandled rejection" noise; errors are handled in waitForId.
      promise.catch(() => {});
      return promise;
    }

    function start(data) {
      lastData = data;
      pending = begin(data);
      return pending;
    }

    async function waitForId() {
      if (!pending) throw new Error('No test has been saved yet.');
      try {
        return await pending;
      } catch {
        pending = begin(lastData);
        return pending;
      }
    }

    return { start, waitForId };
  }

  const api = { createSaveTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
