// ============================================================
//  api/quota.js
//  Per-user daily generation quota.
//
//  The rules are pure functions (easy to test). Two stores use them:
//   - Firestore store: used by the real server. One document per
//     user at quotas/{uid} = { date: 'YYYY-MM-DD', count }.
//     Updated in a transaction so two parallel requests cannot
//     both take the last slot. Browsers cannot read or write it
//     (firestore.rules denies the "quotas" collection).
//   - Memory store: used by tests.
//  Days are counted in UTC so the reset time is the same for everyone.
// ============================================================

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Decide whether one more generation is allowed today. */
function consumeQuota(current, today, limit) {
  const usedToday = current && current.date === today ? current.count : 0;
  if (usedToday >= limit) {
    return { allowed: false, next: null, remaining: 0 };
  }
  const next = { date: today, count: usedToday + 1 };
  return { allowed: true, next, remaining: limit - next.count };
}

/** Give one generation back (used when generation failed). Returns null if nothing to refund. */
function refundQuota(current, today) {
  if (!current || current.date !== today || current.count <= 0) return null;
  return { date: today, count: current.count - 1 };
}

function createMemoryQuotaStore({ limit, now = () => new Date() }) {
  const usage = new Map();

  async function tryConsume(uid) {
    const decision = consumeQuota(usage.get(uid), utcDateString(now()), limit);
    if (decision.allowed) usage.set(uid, decision.next);
    return { allowed: decision.allowed, remaining: decision.remaining, limit };
  }

  async function refund(uid) {
    const next = refundQuota(usage.get(uid), utcDateString(now()));
    if (next) usage.set(uid, next);
  }

  return { tryConsume, refund };
}

function createFirestoreQuotaStore({ db, limit, now = () => new Date() }) {
  const quotaRef = (uid) => db.collection('quotas').doc(uid);

  async function tryConsume(uid) {
    const ref = quotaRef(uid);
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? snap.data() : null;
      const result = consumeQuota(current, utcDateString(now()), limit);
      if (result.allowed) tx.set(ref, result.next);
      return result;
    });
    return { allowed: decision.allowed, remaining: decision.remaining, limit };
  }

  async function refund(uid) {
    const ref = quotaRef(uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = refundQuota(snap.exists ? snap.data() : null, utcDateString(now()));
      if (next) tx.set(ref, next);
    });
  }

  return { tryConsume, refund };
}

module.exports = {
  utcDateString,
  consumeQuota,
  refundQuota,
  createMemoryQuotaStore,
  createFirestoreQuotaStore,
};
