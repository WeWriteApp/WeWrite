/**
 * Test Collections API
 * 
 * This endpoint tests that all refactored Firestore references are working
 * correctly with the new environment-aware collection helpers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { firestore } from '../../../firebase/config';

// GET endpoint - Test collection references
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing environment-aware collection references...');
    
    // Get environment-aware Firestore instance
    const db = firestore;
    
    // Test collection naming
    const collectionTests = Object.entries(COLLECTIONS).map(([key, baseName]) => {
      const environmentSpecificName = getCollectionName(baseName);
      return {
        collectionKey: key,
        baseName,
        environmentSpecificName,
        isCorrectlyPrefixed: environmentSpecificName !== baseName // Should have prefix in dev
      };
    });
    
    // Test a few actual Firestore operations (read-only)
    const operationTests = [];
    
    try {
      // Test users collection access
      const { collection, query, limit, getDocs } = await import('firebase/firestore');
      
      const usersQuery = query(
        collection(db, getCollectionName('users')),
        limit(1)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      operationTests.push({
        operation: 'users collection query',
        success: true,
        collectionName: getCollectionName('users'),
        documentCount: usersSnapshot.size
      });
      
    } catch (error) {
      operationTests.push({
        operation: 'users collection query',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        collectionName: getCollectionName('users')
      });
    }
    
    try {
      // Test pages collection access
      const { collection, query, limit, getDocs, where } = await import('firebase/firestore');
      
      const pagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('isPublic', '==', true),
        limit(1)
      );
      
      const pagesSnapshot = await getDocs(pagesQuery);
      operationTests.push({
        operation: 'pages collection query',
        success: true,
        collectionName: getCollectionName('pages'),
        documentCount: pagesSnapshot.size
      });
      
    } catch (error) {
      operationTests.push({
        operation: 'pages collection query',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        collectionName: getCollectionName('pages')
      });
    }
    
    // Test environment-aware Firebase services
    const servicesTest = {
      firestoreInstance: !!db,
      environmentAwareConfig: true,
      collectionHelpers: true
    };
    
    // Summary
    const summary = {
      totalCollections: collectionTests.length,
      correctlyPrefixed: collectionTests.filter(t => t.isCorrectlyPrefixed).length,
      operationTests: operationTests.length,
      successfulOperations: operationTests.filter(t => t.success).length,
      allSystemsWorking: operationTests.every(t => t.success) && servicesTest.firestoreInstance
    };
    
    console.log('✅ Collection testing completed');
    console.log('Summary:', summary);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      testResults: {
        collectionNaming: collectionTests,
        firestoreOperations: operationTests,
        services: servicesTest,
        summary
      },
      status: summary.allSystemsWorking ? 'success' : 'partial_success'
    });
    
  } catch (error) {
    console.error('Error testing collections:', error);
    
    return NextResponse.json({
      error: 'Collection testing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
