/**
 * Script to check page content for corruption
 * Usage: NODE_ENV=development npx tsx scripts/check-page-content.ts <pageId>
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Robust Firebase Admin initialization function
function getFirebaseAdminAndDb() {
  try {
    let app = getApps().find(app => app.name === 'page-check-app');

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
      }, 'page-check-app');
    }

    const db = getFirestore(app);
    return { db };
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

function deepInspect(obj: any, path: string = '', issues: string[] = []): string[] {
  if (obj === null) {
    issues.push(`${path}: null value`);
    return issues;
  }

  if (obj === undefined) {
    issues.push(`${path}: undefined value`);
    return issues;
  }

  if (typeof obj === 'string') {
    // Check for problematic characters
    if (obj.includes('\u0000')) {
      issues.push(`${path}: Contains null character`);
    }
    if (obj.includes('\uFFFD')) {
      issues.push(`${path}: Contains replacement character`);
    }
    // Check for very long strings
    if (obj.length > 10000) {
      issues.push(`${path}: Very long string (${obj.length} chars)`);
    }
    return issues;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      issues.push(`${path}: Empty array`);
    }
    obj.forEach((item, index) => {
      deepInspect(item, `${path}[${index}]`, issues);
    });
    return issues;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      issues.push(`${path}: Empty object`);
    }

    // Check for Slate.js specific issues
    if ('type' in obj) {
      // This is likely a Slate node
      if (!obj.children && obj.type !== 'text') {
        issues.push(`${path}: Node with type "${obj.type}" has no children`);
      }
      if (obj.children && !Array.isArray(obj.children)) {
        issues.push(`${path}: Node children is not an array`);
      }
    }

    // Check for text nodes
    if ('text' in obj) {
      if (typeof obj.text !== 'string') {
        issues.push(`${path}: text property is not a string (type: ${typeof obj.text})`);
      }
    }

    // Recurse into object properties
    for (const key of keys) {
      deepInspect(obj[key], `${path}.${key}`, issues);
    }

    return issues;
  }

  return issues;
}

async function checkPage(pageId: string) {
  const { db } = getFirebaseAdminAndDb();

  try {
    const pageDoc = await db.collection('pages').doc(pageId).get();

    if (!pageDoc.exists) {
      console.log('Page not found');
      return;
    }

    const data = pageDoc.data();
    console.log('=== PAGE METADATA ===');
    console.log('Title:', data?.title);
    console.log('userId:', data?.userId);
    console.log('username:', data?.username);
    console.log('createdAt:', data?.createdAt);
    console.log('lastModified:', data?.lastModified);
    console.log('currentVersion:', data?.currentVersion);

    console.log('\n=== CONTENT STRUCTURE ===');
    console.log('Content type:', typeof data?.content);
    console.log('Content is array:', Array.isArray(data?.content));

    if (Array.isArray(data?.content)) {
      console.log('Content length:', data.content.length);

      // Deep inspection
      console.log('\n=== DEEP CONTENT INSPECTION ===');
      const issues = deepInspect(data.content, 'content');

      if (issues.length === 0) {
        console.log('✅ No structural issues found');
      } else {
        console.log('⚠️ Issues found:');
        issues.forEach(issue => console.log('  -', issue));
      }

      // Print each node structure
      console.log('\n=== NODE BY NODE ANALYSIS ===');
      data.content.forEach((node: any, index: number) => {
        console.log(`\n--- Node ${index} ---`);
        console.log('Type:', node.type);
        console.log('Has children:', !!node.children);
        if (node.children) {
          console.log('Children count:', node.children.length);
          node.children.forEach((child: any, childIndex: number) => {
            console.log(`  Child ${childIndex}:`, JSON.stringify(child).substring(0, 150));

            // Check for link nodes specifically
            if (child.type === 'link') {
              console.log(`    Link details:`);
              console.log(`      pageId: ${child.pageId}`);
              console.log(`      pageTitle: ${child.pageTitle}`);
              console.log(`      url: ${child.url}`);
              console.log(`      isExternal: ${child.isExternal}`);
              console.log(`      showAuthor: ${child.showAuthor}`);
              console.log(`      Has children: ${!!child.children}`);
              if (child.children) {
                console.log(`      Link children:`, JSON.stringify(child.children));
              }
            }
          });
        }
      });

      // Raw JSON for comparison
      console.log('\n=== RAW CONTENT JSON ===');
      console.log(JSON.stringify(data.content, null, 2));
    } else if (typeof data?.content === 'string') {
      console.log('Content is a STRING (legacy format)');
      try {
        const parsed = JSON.parse(data.content);
        console.log('Parsed content length:', parsed.length);
      } catch (e) {
        console.log('⚠️ Failed to parse content string as JSON');
      }
    }

    // Check versions collection
    console.log('\n=== CHECKING VERSIONS ===');
    const versionsRef = db.collection('pages').doc(pageId).collection('versions');
    const versions = await versionsRef.orderBy('createdAt', 'desc').limit(3).get();
    console.log('Version count (recent 3):', versions.size);
    versions.docs.forEach((doc, i) => {
      const vData = doc.data();
      console.log(`  Version ${i + 1}: ${doc.id}, created: ${vData.createdAt?._seconds ? new Date(vData.createdAt._seconds * 1000).toISOString() : 'unknown'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

const pageId = process.argv[2] || '8tyuD33dFnYwIXt0It8p';
console.log(`Checking page: ${pageId}\n`);
checkPage(pageId);
