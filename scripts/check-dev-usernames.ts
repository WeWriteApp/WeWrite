/**
 * Quick check of DEV_users and DEV_pages usernames
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || '';
  if (!jsonString.startsWith('{')) {
    jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
  }
  const serviceAccount = JSON.parse(jsonString);

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('=== DEV_users collection ===');
  const users = await db.collection('DEV_users').get();
  for (const doc of users.docs) {
    const data = doc.data();
    console.log(`  ${doc.id.substring(0, 12)}... -> username: "${data.username || '(none)'}"`);
  }

  console.log('\n=== Sample DEV_pages (last 10 modified) ===');
  const pages = await db.collection('DEV_pages')
    .orderBy('lastModified', 'desc')
    .limit(10)
    .get();

  for (const doc of pages.docs) {
    const data = doc.data();
    console.log(`  ${doc.id.substring(0, 12)}... -> username: "${data.username || '(none)'}", userId: ${data.userId?.substring(0, 8) || 'none'}...`);
  }

  process.exit(0);
}

main().catch(console.error);
