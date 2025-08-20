/**
 * Public API for fetching landing page cards configuration
 * Used by the landing page to get the current card configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

const LANDING_PAGE_CONFIG_DOC_ID = 'landing-page-cards';

// GET endpoint - Get current landing page cards configuration
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the landing page configuration document
    const configDoc = await db
      .collection(getCollectionName('config'))
      .doc(LANDING_PAGE_CONFIG_DOC_ID)
      .get();

    let cards = [];
    
    if (configDoc.exists) {
      const data = configDoc.data();
      cards = data?.cards || [];
    } else {
      // If no config exists, return the default configuration
      const { LANDING_PAGE_CARDS } = await import('../../../config/landingPageCards');
      cards = LANDING_PAGE_CARDS;
    }

    return createApiResponse({
      cards,
      lastUpdated: configDoc.exists ? configDoc.data()?.lastUpdated : null
    });

  } catch (error) {
    console.error('Error fetching landing page cards config:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch landing page cards configuration');
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'X-Service': 'public-landing-page-cards-api',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
