/**
 * Admin API for managing landing page cards
 * Allows admins to configure which pages appear on the logged-out landing page
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import type { LandingPageCardConfig } from '../../../config/landingPageCards';

const LANDING_PAGE_CONFIG_DOC_ID = 'landing-page-cards';

// GET endpoint - Get current landing page cards configuration
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse('FORBIDDEN', adminCheck.error);
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the landing page configuration document
    const configDoc = await db
      .collection(getCollectionName('config'))
      .doc(LANDING_PAGE_CONFIG_DOC_ID)
      .get();

    let cards: LandingPageCardConfig[] = [];
    
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

// POST endpoint - Update landing page cards configuration
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse('FORBIDDEN', adminCheck.error);
    }

    const { cards } = await request.json();

    if (!Array.isArray(cards)) {
      return createErrorResponse('BAD_REQUEST', 'Cards must be an array');
    }

    // Validate each card configuration
    for (const card of cards) {
      if (!card.id || !card.pageId) {
        return createErrorResponse('BAD_REQUEST', 'Each card must have an id and pageId');
      }
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Update the configuration document
    const configData = {
      cards,
      lastUpdated: new Date().toISOString(),
      updatedBy: adminCheck.user.uid
    };

    await db
      .collection(getCollectionName('config'))
      .doc(LANDING_PAGE_CONFIG_DOC_ID)
      .set(configData);

    console.log(`Landing page cards configuration updated by admin ${adminCheck.user.uid}`);

    return createApiResponse({
      success: true,
      cards,
      message: 'Landing page cards configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating landing page cards config:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update landing page cards configuration');
  }
}

// DELETE endpoint - Reset to default configuration
export async function DELETE(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse('FORBIDDEN', adminCheck.error);
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Delete the configuration document to revert to defaults
    await db
      .collection(getCollectionName('config'))
      .doc(LANDING_PAGE_CONFIG_DOC_ID)
      .delete();

    console.log(`Landing page cards configuration reset to defaults by admin ${adminCheck.user.uid}`);

    return createApiResponse({
      success: true,
      message: 'Landing page cards configuration reset to defaults'
    });

  } catch (error) {
    console.error('Error resetting landing page cards config:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to reset landing page cards configuration');
  }
}
