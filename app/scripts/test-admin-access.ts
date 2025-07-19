/**
 * Test script to verify admin access and Firebase collections
 * Run this to debug admin dashboard issues
 */

import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { getCollectionName } from '../utils/environmentConfig';

export async function testAdminAccess() {
  console.log('🔍 [Admin Access Test] Starting test...');
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    collections: {}
  };

  // Test different collections that the admin dashboard uses
  const collectionsToTest = [
    'users',
    'pages', 
    'pageViews',
    'analytics_events',
    'analytics_daily',
    'analytics_hourly'
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
        accessible: true,
        sampleDoc: snapshot.size > 0 ? snapshot.docs[0].data() : null
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

  console.log('🔍 [Admin Access Test] Test complete:', results);
  return results;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testAdminAccess = testAdminAccess;
}
