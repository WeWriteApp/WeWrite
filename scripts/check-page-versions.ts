/**
 * Script to check page version history
 * Usage: NODE_ENV=development npx tsx scripts/check-page-versions.ts <pageId>
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function getFirebaseAdminAndDb() {
  try {
    let app = getApps().find(app => app.name === 'version-check-app');

    if (!app) {
      const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
      if (!base64Json) {
        throw new Error('GOOGLE_CLOUD_KEY_JSON environment variable not found');
      }

      const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedJson);

      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
        })
      }, 'version-check-app');
    }

    const db = getFirestore(app);
    return { db };
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

async function checkVersions(pageId: string) {
  const { db } = getFirebaseAdminAndDb();

  try {
    // Get all versions
    const versionsRef = db.collection('pages').doc(pageId).collection('versions');
    const versions = await versionsRef.orderBy('createdAt', 'desc').get();

    console.log('=== ALL VERSIONS ===');
    console.log('Total versions:', versions.size);

    for (const doc of versions.docs) {
      const vData = doc.data();
      console.log('\n--- Version:', doc.id, '---');
      console.log('CreatedAt:', vData.createdAt?._seconds ? new Date(vData.createdAt._seconds * 1000).toISOString() : 'unknown');
      console.log('Content type:', typeof vData.content);
      console.log('Content is array:', Array.isArray(vData.content));
      if (Array.isArray(vData.content)) {
        console.log('Content length:', vData.content.length);
        console.log('Content preview:', JSON.stringify(vData.content).substring(0, 500));
      } else if (typeof vData.content === 'string') {
        console.log('Content is STRING, length:', vData.content.length);
        try {
          const parsed = JSON.parse(vData.content);
          console.log('Parsed content length:', parsed.length);
        } catch (e) {
          console.log('Could not parse content string');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

const pageId = process.argv[2] || '8tyuD33dFnYwIXt0It8p';
console.log(`Checking versions for page: ${pageId}\n`);
checkVersions(pageId);
