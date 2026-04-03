// Script to inspect page content for debugging
// Usage: npx tsx scripts/inspect-page.ts <pageId>

import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from multiple files
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env.development') });
config({ path: path.resolve(process.cwd(), '.env') });

import * as admin from 'firebase-admin';

const pageId = process.argv[2] || 'ogYuuQuzcHBfFT1OGSEE';

// Initialize Firebase Admin using LOGGING_CLOUD_KEY_JSON (full service account)
if (!admin.apps.length) {
  let keyJson = process.env.LOGGING_CLOUD_KEY_JSON || process.env.GOOGLE_CLOUD_KEY_JSON;
  if (!keyJson) {
    console.error('Error: Neither LOGGING_CLOUD_KEY_JSON nor GOOGLE_CLOUD_KEY_JSON is set');
    process.exit(1);
  }

  // Remove actual newline characters that break JSON parsing
  keyJson = keyJson.replace(/\n/g, '').replace(/\r/g, '');

  const serviceAccount = JSON.parse(keyJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function inspectPage() {
  console.log(`\n=== Inspecting page: ${pageId} ===\n`);

  // Try production collection first
  let doc = await db.collection('pages').doc(pageId).get();
  let collectionUsed = 'pages';

  if (!doc.exists) {
    // Try DEV_ prefix
    doc = await db.collection('DEV_pages').doc(pageId).get();
    collectionUsed = 'DEV_pages';
  }

  if (!doc.exists) {
    console.log('Page not found in pages or DEV_pages collections');
    process.exit(1);
  }

  console.log(`Found in collection: ${collectionUsed}`);

  const data = doc.data()!;
  console.log(`Title: ${data.title}`);
  console.log(`UserID: ${data.userId}`);
  console.log(`Created: ${data.createdAt?.toDate?.() || data.createdAt}`);

  // Parse content
  let content = data.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (e) {
      console.log('\nContent is a string but not valid JSON:', content.substring(0, 200));
      process.exit(1);
    }
  }

  console.log(`\n=== Content Structure (${content?.length || 0} nodes) ===\n`);

  // Analyze each paragraph for link/URL issues
  if (Array.isArray(content)) {
    content.forEach((node: any, nodeIndex: number) => {
      if (node.type === 'paragraph' && node.children) {
        // Check if any child has a URL pattern in text (potential auto-link)
        const hasUrlInText = node.children.some((child: any) =>
          child.text && /(https?:\/\/|www\.)/i.test(child.text)
        );

        // Check if any child is a link node
        const hasLinkNodes = node.children.some((child: any) => child.type === 'link');

        if (hasUrlInText || hasLinkNodes) {
          console.log(`\n--- Paragraph ${nodeIndex} ---`);
          console.log('Children:');
          node.children.forEach((child: any, childIndex: number) => {
            if (child.type === 'link') {
              console.log(`  [${childIndex}] LINK: url="${child.url}", isExternal=${child.isExternal}`);
              if (child.children) {
                console.log(`       text: "${child.children.map((c: any) => c.text).join('')}"`);
              }
            } else if (child.text) {
              const hasUrl = /(https?:\/\/|www\.)/i.test(child.text);
              console.log(`  [${childIndex}] TEXT${hasUrl ? ' (HAS URL!)' : ''}: "${child.text.substring(0, 100)}${child.text.length > 100 ? '...' : ''}"`);
              if (child.bold) console.log('       (bold)');
              if (child.italic) console.log('       (italic)');
              if (child.underline) console.log('       (underline)');
            } else {
              console.log(`  [${childIndex}] OTHER:`, JSON.stringify(child).substring(0, 100));
            }
          });
        }
      }
    });
  }

  console.log('\n=== Full Content JSON ===\n');
  console.log(JSON.stringify(content, null, 2));
}

inspectPage()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
