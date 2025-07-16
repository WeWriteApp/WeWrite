/**
 * Collections Debug Endpoint
 * 
 * Shows what collections exist in the database for debugging
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
      'users',
      'DEV_users', 
      'PROD_users',
      'usernames',
      'DEV_usernames',
      'PROD_usernames'
    ];

    const collectionInfo = [];

    for (const collectionName of collectionsToCheck) {
      try {
        const snapshot = await db.collection(collectionName).limit(5).get();
        collectionInfo.push({
          name: collectionName,
          exists: !snapshot.empty,
          documentCount: snapshot.size,
          sampleDocIds: snapshot.docs.map(doc => doc.id).slice(0, 3)
        });
      } catch (error) {
        collectionInfo.push({
          name: collectionName,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Show what the current environment expects
    const expectedCollections = {
      users: getCollectionName('users'),
      usernames: getCollectionName('usernames'),
    };

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        expectedCollections,
      },
      availableCollections: collectionInfo,
      recommendations: {
        preview: 'Preview environment expects PROD_ prefixed collections',
        development: 'Development environment expects DEV_ prefixed collections', 
        production: 'Production environment expects base collection names',
      }
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Collections debug error:', error);
    return NextResponse.json({
      error: 'Failed to check collections',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
