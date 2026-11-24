// ============================================================
//  api/firebaseAdmin.js
//  Starts the Firebase Admin SDK with the service-account key.
//  The Admin SDK runs only on the server. It can verify ID tokens
//  and read/write Firestore without being limited by firestore.rules,
//  so the key must never reach the browser or git.
// ============================================================

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function initFirebaseAdmin(serviceAccount) {
  const app = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  /** Checks signature, expiry and project of a Firebase ID token. */
  async function verifyIdToken(token) {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  }

  return { verifyIdToken, db };
}

module.exports = { initFirebaseAdmin };
