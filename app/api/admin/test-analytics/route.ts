import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../../firebase/database/core';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Test Analytics API] Starting analytics test...');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      collections: {}
    };

    // Test different collections
    const collectionsToTest = [
      'users',
      'pages', 
      'pageViews',
      'analytics_events'
    ];

    for (const collectionName of collectionsToTest) {
      try {
        const envCollectionName = getCollectionName(collectionName);
        console.log(`🔍 Testing collection: ${collectionName} -> ${envCollectionName}`);
        
        const collectionRef = collection(db, envCollectionName);
        const q = query(collectionRef, limit(1));
        const snapshot = await getDocs(q);
        
        results.collections[collectionName] = {
          envName: envCollectionName,
          exists: true,
          documentCount: snapshot.size,
          accessible: true
        };
        
        console.log(`✅ Collection ${envCollectionName}: ${snapshot.size} documents`);
        
      } catch (error: any) {
        console.error(`❌ Error accessing collection ${collectionName}:`, error);
        
        results.collections[collectionName] = {
          envName: getCollectionName(collectionName),
          exists: false,
          error: {
            code: error.code,
            message: error.message
          },
          accessible: false
        };
      }
    }

    console.log('🔍 [Test Analytics API] Test complete:', results);
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('❌ [Test Analytics API] Test failed:', error);
    
    return NextResponse.json({
      error: {
        message: error.message,
        code: error.code
      }
    }, { status: 500 });
  }
}
