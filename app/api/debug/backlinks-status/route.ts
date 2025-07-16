/**
 * Backlinks Status Debug Endpoint
 * 
 * Shows the status of backlinks collections and data for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getEnvironmentType, getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const envType = getEnvironmentType();

    // Check different collection variations
    const collectionsToCheck = [
      'pages',
      'backlinks',
      'DEV_pages', 
      'DEV_backlinks',
      'PROD_pages',
      'PROD_backlinks'
    ];

    const collectionInfo = [];

    for (const collectionName of collectionsToCheck) {
      try {
        const snapshot = await db.collection(collectionName).limit(5).get();
        const sampleDocs = snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }));
        
        collectionInfo.push({
          name: collectionName,
          exists: !snapshot.empty,
          documentCount: snapshot.size,
          sampleDocs: sampleDocs.slice(0, 2) // Only show first 2 for brevity
        });
      } catch (error) {
        collectionInfo.push({
          name: collectionName,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check specific backlinks for a sample page
    let backlinksSample = null;
    try {
      const pagesSnapshot = await db.collection(getCollectionName('pages')).limit(1).get();
      if (!pagesSnapshot.empty) {
        const samplePageId = pagesSnapshot.docs[0].id;
        const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
          .where('targetPageId', '==', samplePageId)
          .limit(3)
          .get();
        
        backlinksSample = {
          samplePageId,
          backlinksFound: backlinksSnapshot.size,
          backlinks: backlinksSnapshot.docs.map(doc => doc.data())
        };
      }
    } catch (error) {
      backlinksSample = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Show what the current environment expects
    const expectedCollections = {
      pages: getCollectionName('pages'),
      backlinks: getCollectionName('backlinks'),
    };

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        expectedCollections,
      },
      availableCollections: collectionInfo,
      backlinksSample,
      recommendations: {
        development: 'Development environment expects DEV_ prefixed collections',
        preview: 'Preview environment expects base collection names', 
        production: 'Production environment expects base collection names',
        backlinksIndex: 'If backlinks collection is empty, run the backlinks index build script'
      }
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Backlinks status debug error:', error);
    return NextResponse.json({
      error: 'Failed to check backlinks status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
