/**
 * Feature Flags API
 * Provides endpoints for managing feature flags without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse, ApiErrors } from '../auth-helper';
import { checkAdminPermissions } from '../admin-auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { isTestUser } from '../../utils/testUsers';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt?: string;
  lastModified?: string;
}

interface FeatureFlagUpdate {
  enabled: boolean;
  description?: string;
}

// isTestUser is now imported from testUsers.ts

// GET endpoint - Get all feature flags or a specific flag, or check user-specific flag
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const flagId = searchParams.get('id');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    // New parameters for user-specific feature flag checks
    const flag = searchParams.get('flag');
    const targetUserId = searchParams.get('userId');

    // Get user ID for access control
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    // Handle user-specific feature flag check
    if (flag && targetUserId) {
      // Check if the target user is a test user
      if (isTestUser(targetUserId)) {
        // Test users always have all feature flags enabled
        return createApiResponse({
          success: true,
          enabled: true,
          source: 'test_user_override',
          message: 'Test users have all feature flags enabled by default'
        });
      }

      // For non-test users, check global flag and user overrides
      const flagDoc = await db.collection('config').doc('featureFlags').get();

      let globalEnabled = false;
      if (flagDoc.exists) {
        const flagsData = flagDoc.data();
        globalEnabled = flagsData[flag] === true;
      }

      // Check for user-specific override
      const featureOverrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${targetUserId}_${flag}`);
      const featureOverrideDoc = await featureOverrideRef.get();

      if (featureOverrideDoc.exists) {
        const data = featureOverrideDoc.data();
        return createApiResponse({
          success: true,
          enabled: data.enabled,
          source: 'user_override',
          lastModified: data.lastModified
        });
      } else {
        // No override, use global setting
        return createApiResponse({
          success: true,
          enabled: globalEnabled,
          source: 'global_setting'
        });
      }
    }

    if (flagId) {
      // Get specific feature flag
      const flagDoc = await db.collection('config').doc('featureFlags').get();
      
      if (!flagDoc.exists) {
        return createErrorResponse('NOT_FOUND', 'Feature flags configuration not found');
      }

      const flagsData = flagDoc.data();
      if (!(flagId in flagsData)) {
        return createErrorResponse('NOT_FOUND', `Feature flag '${flagId}' not found`);
      }

      const response: any = {
        id: flagId,
        enabled: flagsData[flagId] === true,
        lastModified: flagDoc.updateTime?.toDate().toISOString()
      };

      // Include history if requested and user is admin
      if (includeHistory) {
        const adminCheck = await checkAdminPermissions(request);
        if (adminCheck.success) {
          const historySnapshot = await db.collection(getCollectionName('featureHistory'))
            .where('featureId', '==', flagId)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

          response.history = historySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate().toISOString()
          }));
        }
      }

      return createApiResponse(response);
    } else {
      // Get all feature flags
      const flagDoc = await db.collection('config').doc('featureFlags').get();
      
      if (!flagDoc.exists) {
        return createApiResponse({});
      }

      const flagsData = flagDoc.data();
      const flags = Object.entries(flagsData).map(([id, enabled]) => ({
        id,
        enabled: enabled === true,
        lastModified: flagDoc.updateTime?.toDate().toISOString()
      }));

      return createApiResponse({ flags });
    }

  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch feature flags');
  }
}

// POST endpoint - Create or update feature flags (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const body = await request.json();
    const { flagId, enabled, description } = body;

    if (!flagId || enabled === undefined) {
      return createErrorResponse('BAD_REQUEST', 'flagId and enabled are required');
    }

    // Update the feature flag
    const flagRef = db.collection('config').doc('featureFlags');
    await flagRef.update({
      [flagId]: enabled
    });

    // Record history
    await db.collection(getCollectionName('featureHistory')).add({
      featureId: flagId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: adminCheck.userEmail,
      action: enabled ? 'enabled' : 'disabled',
      details: description || `Feature flag ${enabled ? 'enabled' : 'disabled'}`
    });

    return createApiResponse({
      flagId,
      enabled,
      message: `Feature flag '${flagId}' ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error updating feature flag:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update feature flag');
  }
}

// PUT endpoint - Sync feature flags with default values (admin only)
export async function PUT(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Define the complete set of feature flags that should exist
    const COMPLETE_FEATURE_FLAGS = {
      payments: false,
      map_view: false,
      calendar_view: false,
      inactive_subscription: false
    };

    const flagRef = db.collection('config').doc('featureFlags');
    const flagDoc = await flagRef.get();

    let currentFlags = {};
    if (flagDoc.exists) {
      currentFlags = flagDoc.data() || {};
    }

    // Merge with defaults, preserving existing values
    const updatedFlags = { ...COMPLETE_FEATURE_FLAGS, ...currentFlags };

    // Update the document
    await flagRef.set(updatedFlags);

    // Record sync action
    await db.collection(getCollectionName('featureHistory')).add({
      featureId: 'system',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: adminCheck.userEmail,
      action: 'sync_flags',
      details: 'Feature flags synchronized with default values'
    });

    return createApiResponse({
      flags: updatedFlags,
      message: 'Feature flags synchronized successfully',
      syncTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error syncing feature flags:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to sync feature flags');
  }
}
