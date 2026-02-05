/**
 * Typesense Sync Script
 *
 * Usage:
 *   bun run scripts/typesense-sync.ts           # Sync development collections
 *   bun run scripts/typesense-sync.ts --prod    # Sync production collections
 */

import Typesense from 'typesense';
import admin from 'firebase-admin';

// Get environment
const isProd = process.argv.includes('--prod');
const envPrefix = isProd ? '' : 'DEV_';

console.log(`\n🔍 Typesense Sync Script`);
console.log(`📦 Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📚 Collection prefix: "${envPrefix}"\n`);

// Typesense config from env
const TYPESENSE_HOST = process.env.NEXT_PUBLIC_TYPESENSE_HOST;
const TYPESENSE_PORT = parseInt(process.env.NEXT_PUBLIC_TYPESENSE_PORT || '443');
const TYPESENSE_PROTOCOL = process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https';
const TYPESENSE_ADMIN_KEY = process.env.TYPESENSE_ADMIN_KEY;

if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_KEY) {
  console.error('❌ Missing Typesense configuration. Set NEXT_PUBLIC_TYPESENSE_HOST and TYPESENSE_ADMIN_KEY');
  process.exit(1);
}

// Initialize Typesense client
const typesense = new Typesense.Client({
  nodes: [{
    host: TYPESENSE_HOST,
    port: TYPESENSE_PORT,
    protocol: TYPESENSE_PROTOCOL,
  }],
  apiKey: TYPESENSE_ADMIN_KEY,
  connectionTimeoutSeconds: 10,
});

// Initialize Firebase Admin
const serviceAccountJson = process.env.GOOGLE_CLOUD_KEY_JSON;
if (!serviceAccountJson) {
  console.error('❌ Missing GOOGLE_CLOUD_KEY_JSON environment variable');
  process.exit(1);
}

let serviceAccount;
try {
  // Check if it's base64 encoded
  if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True') {
    serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf-8'));
  } else {
    serviceAccount = JSON.parse(serviceAccountJson);
  }
} catch (e) {
  console.error('❌ Failed to parse service account JSON');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82',
  });
}

const db = admin.firestore();

// Collection schemas
const pagesSchema = {
  name: `${envPrefix}pages`,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'titleLower', type: 'string' },
    { name: 'content', type: 'string', optional: true },
    { name: 'authorId', type: 'string' },
    { name: 'authorUsername', type: 'string', optional: true },
    { name: 'isPublic', type: 'bool' },
    { name: 'createdAt', type: 'int64' },
    { name: 'lastModified', type: 'int64' },
    { name: 'alternativeTitles', type: 'string[]', optional: true },
  ],
  default_sorting_field: 'lastModified',
};

const usersSchema = {
  name: `${envPrefix}users`,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'username', type: 'string' },
    { name: 'usernameLower', type: 'string' },
    { name: 'displayName', type: 'string', optional: true },
    { name: 'bio', type: 'string', optional: true },
    { name: 'photoURL', type: 'string', optional: true },
    { name: 'createdAt', type: 'int64' },
  ],
  default_sorting_field: 'createdAt',
};

// Helper to convert timestamp to Unix seconds
function toUnixTimestamp(timestamp: any): number {
  if (!timestamp) return Math.floor(Date.now() / 1000);
  if (timestamp.toMillis) return Math.floor(timestamp.toMillis() / 1000);
  if (timestamp._seconds) return timestamp._seconds;
  if (typeof timestamp === 'number') return Math.floor(timestamp / 1000);
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

// Extract text from Slate content
function extractTextFromContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return content;
    }
  }
  if (Array.isArray(content)) {
    return content
      .map((node: any) => {
        if (node.text) return node.text;
        if (node.children) return extractTextFromContent(node.children);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

// Ensure collection exists
async function ensureCollection(schema: any) {
  try {
    await typesense.collections(schema.name).retrieve();
    console.log(`✓ Collection ${schema.name} exists`);
  } catch (e: any) {
    if (e.httpStatus === 404) {
      console.log(`Creating collection ${schema.name}...`);
      await typesense.collections().create(schema);
      console.log(`✓ Created collection ${schema.name}`);
    } else {
      throw e;
    }
  }
}

// Sync pages
async function syncPages() {
  const collectionName = `${envPrefix}pages`;
  const firestoreCollection = isProd ? 'pages' : 'DEV_pages';

  console.log(`\n📄 Syncing pages from ${firestoreCollection} to ${collectionName}...`);

  let synced = 0;
  let errors = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;
  const batchSize = 100;

  while (true) {
    let query: admin.firestore.Query = db.collection(firestoreCollection).limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const documents: any[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        if (data.deleted || !data.title) continue;

        documents.push({
          id: doc.id,
          title: data.title,
          titleLower: data.title.toLowerCase(),
          content: extractTextFromContent(data.content)?.substring(0, 10000),
          authorId: data.userId || data.authorId || '',
          authorUsername: data.authorUsername || data.username || '',
          isPublic: data.isPublic ?? true,
          createdAt: toUnixTimestamp(data.createdAt),
          lastModified: toUnixTimestamp(data.lastModified),
          alternativeTitles: data.alternativeTitles || [],
        });
      } catch (err) {
        errors++;
      }
    }

    if (documents.length > 0) {
      try {
        const results = await typesense
          .collections(collectionName)
          .documents()
          .import(documents, { action: 'upsert' });

        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;
        synced += successCount;
        errors += failCount;

        process.stdout.write(`\r  Synced ${synced} pages...`);
      } catch (err) {
        errors += documents.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(`\n✓ Pages: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// Sync users
async function syncUsers() {
  const collectionName = `${envPrefix}users`;
  const firestoreCollection = isProd ? 'users' : 'DEV_users';

  console.log(`\n👤 Syncing users from ${firestoreCollection} to ${collectionName}...`);

  let synced = 0;
  let errors = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;
  const batchSize = 100;

  while (true) {
    let query: admin.firestore.Query = db.collection(firestoreCollection).limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const documents: any[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        if (!data.username) continue;

        // Bio can be a string or Slate document - convert to text
        let bioText = '';
        if (data.bio) {
          if (typeof data.bio === 'string') {
            bioText = data.bio;
          } else {
            bioText = extractTextFromContent(data.bio);
          }
        }

        documents.push({
          id: doc.id,
          username: data.username,
          usernameLower: data.usernameLower || data.username.toLowerCase(),
          displayName: data.displayName || data.username,
          bio: bioText,
          photoURL: data.photoURL || '',
          createdAt: toUnixTimestamp(data.createdAt),
        });
      } catch (err) {
        errors++;
      }
    }

    if (documents.length > 0) {
      try {
        const results = await typesense
          .collections(collectionName)
          .documents()
          .import(documents, { action: 'upsert' });

        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;
        synced += successCount;
        errors += failCount;

        process.stdout.write(`\r  Synced ${synced} users...`);
      } catch (err) {
        errors += documents.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(`\n✓ Users: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// Main
async function main() {
  try {
    // Test connection
    console.log('Testing Typesense connection...');
    const health = await typesense.health.retrieve();
    console.log(`✓ Typesense is healthy: ${health.ok}`);

    // Ensure collections exist
    await ensureCollection(pagesSchema);
    await ensureCollection(usersSchema);

    // Sync data
    const pagesResult = await syncPages();
    const usersResult = await syncUsers();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Sync Summary');
    console.log('='.repeat(50));
    console.log(`Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`Pages: ${pagesResult.synced} synced, ${pagesResult.errors} errors`);
    console.log(`Users: ${usersResult.synced} synced, ${usersResult.errors} errors`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
