// Reads a fetch() Response safely. Loaded by the browser AND by `node --test`.
// Old code called res.json() directly, so an HTML error page (for example
// Render's 502 while the server wakes up) showed "Unexpected token <".
(function (root) {
  function messageForStatus(status) {
    if (status === 401) return 'Please sign in again.';
    if (status === 429) return 'Too many requests. Please wait a little and try again.';
    if (status >= 500) {
      return 'The server is not responding right now. It may be waking up; please try again in a minute.';
    }
    return 'The request failed. Please try again.';
  }

  async function tryParseJson(res) {
    const type = res.headers.get('Content-Type') || '';
    if (!type.includes('application/json')) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  /** Returns the JSON body of a successful response, or throws an Error with a friendly message. */
  async function readJsonResponse(res) {
    const data = await tryParseJson(res);

    if (res.ok) {
      if (data === null) throw new Error('The server sent an unexpected response. Please try again.');
      return data;
    }
    if (data && typeof data.error === 'string') throw new Error(data.error);
    throw new Error(messageForStatus(res.status));
  }

  const api = { readJsonResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
