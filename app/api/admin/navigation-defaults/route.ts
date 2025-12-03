import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { isAdmin } from '../../../utils/isAdmin';
import { cookies } from 'next/headers';

/**
 * Navigation Defaults API
 * 
 * Allows admins to configure the default navigation order for all users.
 * These defaults are used when a user hasn't customized their navigation.
 * 
 * GET - Retrieve current navigation defaults
 * POST - Update navigation defaults
 */

// Default values if nothing is configured
const SYSTEM_DEFAULTS = {
  mobileToolbar: ['home', 'search', 'notifications'],
  desktopSidebar: [
    'home',
    'search',
    'random-pages',
    'new',
    'trending-pages',
    'following',
    'recents',
    'notifications',
    'profile',
    'settings',
    'admin'
  ],
  unifiedMobile: [
    'home',
    'search',
    'profile',
    'notifications',
    'leaderboard',
    'random-pages',
    'trending-pages',
    'following',
    'recents',
    'settings',
    'admin'
  ]
};

// All available navigation items
const ALL_NAV_ITEMS = [
  'home',
  'search',
  'new',
  'notifications',
  'random-pages',
  'trending-pages',
  'following',
  'recents',
  'settings',
  'admin',
  'profile',
  'leaderboard'
];

export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('wewrite_user_email')?.value;
    
    if (!sessionCookie || !isAdmin(sessionCookie)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = initAdmin();
    const db = admin.firestore();
    
    // Get navigation defaults from Firestore
    const docRef = db.collection('settings').doc('navigation_defaults');
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Return system defaults if not configured
      return NextResponse.json({
        success: true,
        data: {
          ...SYSTEM_DEFAULTS,
          allNavItems: ALL_NAV_ITEMS,
          lastUpdated: null,
          updatedBy: null
        }
      });
    }
    
    const data = doc.data();
    return NextResponse.json({
      success: true,
      data: {
        mobileToolbar: data?.mobileToolbar || SYSTEM_DEFAULTS.mobileToolbar,
        desktopSidebar: data?.desktopSidebar || SYSTEM_DEFAULTS.desktopSidebar,
        unifiedMobile: data?.unifiedMobile || SYSTEM_DEFAULTS.unifiedMobile,
        allNavItems: ALL_NAV_ITEMS,
        lastUpdated: data?.lastUpdated?.toDate?.()?.toISOString() || null,
        updatedBy: data?.updatedBy || null
      }
    });

  } catch (error) {
    console.error('Error fetching navigation defaults:', error);
    return NextResponse.json({
      error: 'Failed to fetch navigation defaults',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('wewrite_user_email')?.value;
    
    if (!sessionCookie || !isAdmin(sessionCookie)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { mobileToolbar, desktopSidebar, unifiedMobile } = body;

    // Validate input
    if (mobileToolbar && (!Array.isArray(mobileToolbar) || mobileToolbar.length !== 3)) {
      return NextResponse.json({
        error: 'Mobile toolbar must be an array of exactly 3 items'
      }, { status: 400 });
    }

    if (desktopSidebar && !Array.isArray(desktopSidebar)) {
      return NextResponse.json({
        error: 'Desktop sidebar must be an array'
      }, { status: 400 });
    }

    if (unifiedMobile && !Array.isArray(unifiedMobile)) {
      return NextResponse.json({
        error: 'Unified mobile must be an array'
      }, { status: 400 });
    }

    // Validate all items are valid nav items
    const validateItems = (items: string[], name: string) => {
      const invalid = items.filter(item => !ALL_NAV_ITEMS.includes(item));
      if (invalid.length > 0) {
        throw new Error(`Invalid navigation items in ${name}: ${invalid.join(', ')}`);
      }
    };

    if (mobileToolbar) validateItems(mobileToolbar, 'mobileToolbar');
    if (desktopSidebar) validateItems(desktopSidebar, 'desktopSidebar');
    if (unifiedMobile) validateItems(unifiedMobile, 'unifiedMobile');

    const admin = initAdmin();
    const db = admin.firestore();
    
    // Get current values to merge
    const docRef = db.collection('settings').doc('navigation_defaults');
    const currentDoc = await docRef.get();
    const currentData = currentDoc.exists ? currentDoc.data() : {};

    // Update navigation defaults
    const updateData: Record<string, any> = {
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: sessionCookie
    };

    if (mobileToolbar) updateData.mobileToolbar = mobileToolbar;
    if (desktopSidebar) updateData.desktopSidebar = desktopSidebar;
    if (unifiedMobile) updateData.unifiedMobile = unifiedMobile;

    await docRef.set(updateData, { merge: true });

    console.log(`📱 Navigation defaults updated by ${sessionCookie}`);

    return NextResponse.json({
      success: true,
      message: 'Navigation defaults updated successfully',
      data: {
        mobileToolbar: mobileToolbar || currentData?.mobileToolbar || SYSTEM_DEFAULTS.mobileToolbar,
        desktopSidebar: desktopSidebar || currentData?.desktopSidebar || SYSTEM_DEFAULTS.desktopSidebar,
        unifiedMobile: unifiedMobile || currentData?.unifiedMobile || SYSTEM_DEFAULTS.unifiedMobile
      }
    });

  } catch (error) {
    console.error('Error updating navigation defaults:', error);
    return NextResponse.json({
      error: 'Failed to update navigation defaults',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
