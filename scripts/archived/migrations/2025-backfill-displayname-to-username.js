/**
 * Migration: Backfill usernames from displayName/email and mirror displayName to username.
 *
 * Run with:
 *   node scripts/migrations/2025-backfill-displayname-to-username.js
 *
 * Requirements:
 * - GOOGLE_CLOUD_KEY_JSON (base64 or raw JSON) available in env
 */

const { getFirebaseAdmin } = require('../firebase/firebaseAdmin');
const { getCollectionName } = require('../utils/environmentConfig');

function sanitizeUsername(username, fallback = 'user_unknown') {
  if (!username || typeof username !== 'string') {
    return fallback;
  }
  const trimmed = username.trim();
  if (!trimmed || trimmed.includes('@')) {
    return fallback;
  }
  return trimmed;
}

async function main() {
  const admin = getFirebaseAdmin();
  if (!admin) {
    console.error('Firebase Admin not initialized. Check GOOGLE_CLOUD_KEY_JSON.');
    process.exit(1);
  }

  const db = admin.firestore();
  const usersCollection = getCollectionName('users');
  const snapshot = await db.collection(usersCollection).get();

  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const fallback = `user_${doc.id.slice(0, 8)}`;
    const safeUsername = sanitizeUsername(
      data.username || data.displayName || data.email,
      fallback
    );

    const needsUpdate =
      data.username !== safeUsername || data.displayName !== safeUsername;

    if (needsUpdate) {
      await doc.ref.set(
        {
          username: safeUsername,
          displayName: safeUsername, // mirror for legacy readers
        },
        { merge: true }
      );
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Migration complete. Updated ${updated}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
