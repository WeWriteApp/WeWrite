/**
 * Admin API endpoint to migrate pages without initial versions
 * This fixes the issue where pages created during daily notes migration
 * don't appear in activity feeds because they lack version history.
 */

import { NextResponse } from 'next/server';
import { db } from '../../../firebase/database/core';
import { collection, doc, addDoc, updateDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request) {
  try {
    console.log('🔍 Starting version migration: Finding pages without initial versions...');
    
    // Get all pages (excluding deleted ones)
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('deleted', '!=', true)
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    console.log(`📄 Found ${pagesSnapshot.size} pages to check`);
    
    let pagesWithoutVersions = [];
    let pagesWithVersions = 0;
    let errors = 0;
    
    // Check each page for versions
    for (const pageDoc of pagesSnapshot.docs) {
      const pageId = pageDoc.id;
      const pageData = pageDoc.data();
      
      try {
        // Check if page has any versions
        const versionsQuery = query(
          collection(db, 'pages', pageId, 'versions'),
          limit(1)
        );
        const versionsSnapshot = await getDocs(versionsQuery);
        
        if (versionsSnapshot.empty) {
          pagesWithoutVersions.push({
            id: pageId,
            title: pageData.title || 'Untitled',
            userId: pageData.userId,
            username: pageData.username,
            createdAt: pageData.createdAt,
            lastModified: pageData.lastModified,
            content: pageData.content
          });
          console.log(`❌ Page ${pageId} (${pageData.title || 'Untitled'}) has no versions`);
        } else {
          pagesWithVersions++;
        }
      } catch (error) {
        console.error(`❌ Error checking page ${pageId}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Analysis:`);
    console.log(`  - Pages with versions: ${pagesWithVersions}`);
    console.log(`  - Pages without versions: ${pagesWithoutVersions.length}`);
    console.log(`  - Errors: ${errors}`);
    
    if (pagesWithoutVersions.length === 0) {
      console.log('✅ All pages already have versions. No migration needed.');
      return NextResponse.json({
        success: true,
        message: 'All pages already have versions. No migration needed.',
        stats: {
          pagesWithVersions,
          pagesWithoutVersions: 0,
          migrated: 0,
          errors
        }
      });
    }
    
    console.log(`\n🔧 Creating initial versions for ${pagesWithoutVersions.length} pages...`);
    
    let migrated = 0;
    let migrationErrors = 0;
    
    for (const page of pagesWithoutVersions) {
      try {
        // Create initial version using page creation data
        const versionData = {
          content: page.content || JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
          createdAt: page.createdAt || page.lastModified || new Date().toISOString(),
          userId: page.userId,
          username: page.username || 'Anonymous'
        };
        
        // Create the version
        const versionRef = await addDoc(collection(db, getCollectionName('pages'), page.id, 'versions'), versionData);

        // Update the page with currentVersion reference
        await updateDoc(doc(db, getCollectionName('pages'), page.id), {
          currentVersion: versionRef.id
        });
        
        migrated++;
        console.log(`✅ Created initial version for page ${page.id} (${page.title})`);
        
      } catch (error) {
        console.error(`❌ Error migrating page ${page.id}:`, error.message);
        migrationErrors++;
      }
    }
    
    console.log(`\n🎉 Migration Complete:`);
    console.log(`  - Successfully migrated: ${migrated} pages`);
    console.log(`  - Migration errors: ${migrationErrors} pages`);
    
    return NextResponse.json({
      success: true,
      message: `Migration completed successfully. Created initial versions for ${migrated} pages.`,
      stats: {
        pagesWithVersions,
        pagesWithoutVersions: pagesWithoutVersions.length,
        migrated,
        migrationErrors,
        errors
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
