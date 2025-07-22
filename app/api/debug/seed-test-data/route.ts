import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to seed some test data for analytics testing
 * ONLY for admin use to test analytics functionality
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Seed Test Data] Starting test data seeding...');
    
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const results = {
      timestamp: new Date().toISOString(),
      seeded: []
    };
    
    // Seed some test analytics events
    const analyticsCollection = getCollectionName('analytics_events');
    const now = new Date();
    
    const testEvents = [
      {
        event: 'user_signup',
        timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        userId: 'test-user-1',
        metadata: { source: 'test-seed' }
      },
      {
        event: 'user_signup',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        userId: 'test-user-2',
        metadata: { source: 'test-seed' }
      },
      {
        event: 'page_created',
        timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        userId: 'test-user-1',
        metadata: { 
          pageId: 'test-page-1',
          isPublic: true,
          source: 'test-seed'
        }
      },
      {
        event: 'page_created',
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        userId: 'test-user-2',
        metadata: { 
          pageId: 'test-page-2',
          isPublic: false,
          source: 'test-seed'
        }
      },
      {
        event: 'page_shared',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        userId: 'test-user-1',
        metadata: { 
          pageId: 'test-page-1',
          shareMethod: 'link',
          source: 'test-seed'
        }
      }
    ];
    
    // Add analytics events
    for (const event of testEvents) {
      try {
        const docRef = await db.collection(analyticsCollection).add(event);
        results.seeded.push({
          type: 'analytics_event',
          id: docRef.id,
          event: event.event,
          timestamp: event.timestamp.toISOString()
        });
      } catch (error) {
        results.seeded.push({
          type: 'analytics_event',
          error: error.message,
          event: event.event
        });
      }
    }
    
    // Seed some test users (with recent createdAt)
    const usersCollection = getCollectionName('users');
    const testUsers = [
      {
        email: 'test-user-1@example.com',
        username: 'testuser1',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isTestData: true
      },
      {
        email: 'test-user-2@example.com',
        username: 'testuser2',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        isTestData: true
      }
    ];
    
    for (const user of testUsers) {
      try {
        const docRef = await db.collection(usersCollection).add(user);
        results.seeded.push({
          type: 'user',
          id: docRef.id,
          email: user.email,
          createdAt: user.createdAt.toISOString()
        });
      } catch (error) {
        results.seeded.push({
          type: 'user',
          error: error.message,
          email: user.email
        });
      }
    }
    
    // Seed some test pages
    const pagesCollection = getCollectionName('pages');
    const testPages = [
      {
        title: 'Test Page 1',
        content: 'This is test content for analytics testing',
        authorId: 'test-user-1',
        isPublic: true,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isTestData: true
      },
      {
        title: 'Test Page 2',
        content: 'This is private test content',
        authorId: 'test-user-2',
        isPublic: false,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        isTestData: true
      }
    ];
    
    for (const page of testPages) {
      try {
        const docRef = await db.collection(pagesCollection).add(page);
        results.seeded.push({
          type: 'page',
          id: docRef.id,
          title: page.title,
          isPublic: page.isPublic,
          createdAt: page.createdAt.toISOString()
        });
      } catch (error) {
        results.seeded.push({
          type: 'page',
          error: error.message,
          title: page.title
        });
      }
    }
    
    console.log('[Seed Test Data] Seeded', results.seeded.length, 'test records');
    
    return NextResponse.json(results, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Seed Test Data] Error:', error);
    
    return NextResponse.json({
      error: 'Test data seeding failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
