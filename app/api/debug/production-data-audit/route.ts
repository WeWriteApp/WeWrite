import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * CRITICAL DEBUG: Audit actual production data to see why widgets show zeros
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Production Data Audit] Starting comprehensive data audit...');
    
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
    
    const auditResults = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        collections: {
          users: getCollectionName('users'),
          pages: getCollectionName('pages'),
          analytics_events: getCollectionName('analytics_events'),
          subscriptions: getCollectionName('subscriptions')
        }
      },
      collections: []
    };
    
    // 1. DEEP AUDIT: Users collection (this one works)
    try {
      const usersCollection = getCollectionName('users');
      const usersSnapshot = await db.collection(usersCollection).get();
      
      const recentUsers = [];
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        let createdDate = null;
        if (createdAt) {
          if (createdAt.toDate) {
            createdDate = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            createdDate = new Date(createdAt);
          }
        }
        
        if (createdDate && createdDate >= last7Days) {
          recentUsers.push({
            id: doc.id,
            email: data.email,
            createdAt: createdDate.toISOString(),
            username: data.username
          });
        }
      });
      
      auditResults.collections.push({
        name: 'users',
        collectionName: usersCollection,
        totalDocs: usersSnapshot.size,
        recentDocs: recentUsers.length,
        recentData: recentUsers.slice(0, 10),
        status: 'SUCCESS - This collection works'
      });
    } catch (error) {
      auditResults.collections.push({
        name: 'users',
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 2. DEEP AUDIT: Pages collection (should show pages but doesn't)
    try {
      const pagesCollection = getCollectionName('pages');
      const pagesSnapshot = await db.collection(pagesCollection).get();
      
      const recentPages = [];
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      pagesSnapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        let createdDate = null;
        if (createdAt) {
          if (createdAt.toDate) {
            createdDate = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            createdDate = new Date(createdAt);
          }
        }
        
        if (createdDate && createdDate >= last7Days) {
          recentPages.push({
            id: doc.id,
            title: data.title,
            createdAt: createdDate.toISOString(),
            authorId: data.authorId,
            deleted: data.deleted,
            isPublic: data.isPublic // Check if this field exists
          });
        }
      });
      
      auditResults.collections.push({
        name: 'pages',
        collectionName: pagesCollection,
        totalDocs: pagesSnapshot.size,
        recentDocs: recentPages.length,
        recentData: recentPages.slice(0, 10),
        status: recentPages.length > 0 ? 'HAS DATA - But widget shows 0' : 'NO RECENT DATA'
      });
    } catch (error) {
      auditResults.collections.push({
        name: 'pages',
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 3. DEEP AUDIT: Analytics events (should show shares/edits but doesn't)
    try {
      const analyticsCollection = getCollectionName('analytics_events');
      const analyticsSnapshot = await db.collection(analyticsCollection).get();
      
      const recentEvents = [];
      const eventTypes = new Set();
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      analyticsSnapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const event = data.event;
        const eventType = data.eventType;
        
        // Track what event types exist
        if (event) eventTypes.add(event);
        if (eventType) eventTypes.add(eventType);
        
        let eventDate = null;
        if (timestamp) {
          if (timestamp.toDate) {
            eventDate = timestamp.toDate();
          } else if (typeof timestamp === 'string') {
            eventDate = new Date(timestamp);
          }
        }
        
        if (eventDate && eventDate >= last7Days) {
          recentEvents.push({
            id: doc.id,
            event: event,
            eventType: eventType,
            timestamp: eventDate.toISOString(),
            userId: data.userId,
            hasEventField: !!event,
            hasEventTypeField: !!eventType
          });
        }
      });
      
      auditResults.collections.push({
        name: 'analytics_events',
        collectionName: analyticsCollection,
        totalDocs: analyticsSnapshot.size,
        recentDocs: recentEvents.length,
        recentData: recentEvents.slice(0, 10),
        eventTypesFound: Array.from(eventTypes),
        status: recentEvents.length > 0 ? 'HAS DATA - Check event field structure' : 'NO RECENT DATA'
      });
    } catch (error) {
      auditResults.collections.push({
        name: 'analytics_events',
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 4. DEEP AUDIT: Subscriptions (should show subscription data)
    try {
      const subscriptionsCollection = getCollectionName('subscriptions');
      const subscriptionsSnapshot = await db.collection(subscriptionsCollection).get();
      
      const recentSubscriptions = [];
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      subscriptionsSnapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        let createdDate = null;
        if (createdAt) {
          if (createdAt.toDate) {
            createdDate = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            createdDate = new Date(createdAt);
          }
        }
        
        if (createdDate && createdDate >= last30Days) {
          recentSubscriptions.push({
            id: doc.id,
            userId: data.userId,
            status: data.status,
            createdAt: createdDate.toISOString(),
            plan: data.plan
          });
        }
      });
      
      auditResults.collections.push({
        name: 'subscriptions',
        collectionName: subscriptionsCollection,
        totalDocs: subscriptionsSnapshot.size,
        recentDocs: recentSubscriptions.length,
        recentData: recentSubscriptions.slice(0, 10),
        status: recentSubscriptions.length > 0 ? 'HAS DATA - But widget may not show it' : 'NO RECENT DATA'
      });
    } catch (error) {
      auditResults.collections.push({
        name: 'subscriptions',
        error: error.message,
        status: 'ERROR'
      });
    }
    
    return NextResponse.json(auditResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Production Data Audit] Error:', error);
    
    return NextResponse.json({
      error: 'Production data audit failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
