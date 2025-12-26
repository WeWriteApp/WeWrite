/**
 * Sessions API Endpoint
 *
 * Manages user device sessions:
 * - GET: List all active sessions for the current user
 * - DELETE: Revoke a specific session or all other sessions
 *
 * Used by the Security settings page to manage device access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

// =============================================================================
// Types
// =============================================================================

interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  platform: string;
  userAgent?: string;
}

interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  isActive: boolean;
  isCurrent?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie?.value) return null;

    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData.uid || null;
  } catch {
    return null;
  }
}

async function getCurrentSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionIdCookie = cookieStore.get('sessionId');
    return sessionIdCookie?.value || null;
  } catch {
    return null;
  }
}

function formatDeviceDescription(deviceInfo: DeviceInfo): string {
  const parts: string[] = [];

  if (deviceInfo.browser && deviceInfo.browser !== 'Unknown') {
    parts.push(deviceInfo.browser);
  }

  if (deviceInfo.os && deviceInfo.os !== 'Unknown') {
    parts.push(`on ${deviceInfo.os}`);
  }

  if (parts.length === 0) {
    return deviceInfo.deviceType || 'Unknown device';
  }

  return parts.join(' ');
}

// =============================================================================
// GET - List all active sessions
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const currentSessionId = await getCurrentSessionId();

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const sessionsRef = db.collection(getCollectionName('userSessions'));

    // Get all active sessions for this user
    // Note: We avoid compound queries with orderBy to prevent needing composite indexes
    // Instead, we filter and sort in JavaScript
    const snapshot = await sessionsRef
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const sessions: UserSession[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      sessions.push({
        id: doc.id,
        userId: data.userId,
        deviceInfo: {
          browser: data.deviceInfo?.browser || 'Unknown',
          os: data.deviceInfo?.os || 'Unknown',
          deviceType: data.deviceInfo?.deviceType || 'desktop',
          platform: data.deviceInfo?.platform || 'Unknown',
        },
        createdAt: data.createdAt || new Date().toISOString(),
        lastActiveAt: data.lastActiveAt || data.createdAt || new Date().toISOString(),
        ipAddress: data.ipAddress || 'Unknown',
        isActive: data.isActive,
        isCurrent: doc.id === currentSessionId,
      });
    }

    // Sort to put current session first
    sessions.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });

    return NextResponse.json({
      sessions,
      currentSessionId,
      totalSessions: sessions.length,
    });

  } catch (error) {
    console.error('[Sessions API] Error listing sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Revoke session(s)
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const currentSessionId = await getCurrentSessionId();
    const { searchParams } = new URL(request.url);
    const sessionIdToRevoke = searchParams.get('sessionId');
    const revokeAll = searchParams.get('revokeAll') === 'true';

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const sessionsRef = db.collection(getCollectionName('userSessions'));

    if (revokeAll) {
      // Revoke all sessions except the current one
      const snapshot = await sessionsRef
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      const batch = db.batch();
      let revokedCount = 0;

      for (const doc of snapshot.docs) {
        // Don't revoke current session
        if (doc.id !== currentSessionId) {
          batch.update(doc.ref, {
            isActive: false,
            revokedAt: new Date().toISOString(),
            revokedReason: 'user_revoked_all',
          });
          revokedCount++;
        }
      }

      await batch.commit();

      console.log(`[Sessions API] Revoked ${revokedCount} sessions for user ${userId}`);

      return NextResponse.json({
        success: true,
        revokedCount,
        message: `Signed out of ${revokedCount} other device${revokedCount !== 1 ? 's' : ''}`,
      });

    } else if (sessionIdToRevoke) {
      // Revoke a specific session

      // Prevent revoking current session through this endpoint
      if (sessionIdToRevoke === currentSessionId) {
        return NextResponse.json(
          { error: 'Cannot revoke current session. Use logout instead.' },
          { status: 400 }
        );
      }

      // Verify the session belongs to this user
      const sessionDoc = await sessionsRef.doc(sessionIdToRevoke).get();

      if (!sessionDoc.exists) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      const sessionData = sessionDoc.data();

      if (sessionData?.userId !== userId) {
        return NextResponse.json(
          { error: 'Session does not belong to you' },
          { status: 403 }
        );
      }

      // Revoke the session
      await sessionsRef.doc(sessionIdToRevoke).update({
        isActive: false,
        revokedAt: new Date().toISOString(),
        revokedReason: 'user_revoked',
      });

      console.log(`[Sessions API] Revoked session ${sessionIdToRevoke} for user ${userId}`);

      return NextResponse.json({
        success: true,
        revokedSessionId: sessionIdToRevoke,
        message: 'Device signed out successfully',
      });

    } else {
      return NextResponse.json(
        { error: 'Must specify sessionId or revokeAll=true' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[Sessions API] Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
