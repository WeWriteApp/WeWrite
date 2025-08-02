import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
    os: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    location?: string;
  };
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  isCurrentSession: boolean;
}

interface SessionCreateData {
  userAgent: string;
  ipAddress: string;
}

/**
 * Parse user agent to extract device information
 */
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (ua.includes('mobile')) deviceType = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';
  
  // Detect platform
  let platform = 'Unknown';
  if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) platform = 'Mac';
  else if (ua.includes('linux')) platform = 'Linux';
  else if (ua.includes('android')) platform = 'Android';
  else if (ua.includes('iphone')) platform = 'iPhone';
  else if (ua.includes('ipad')) platform = 'iPad';
  
  return { browser, os, deviceType, platform };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GET /api/auth/sessions - Get all active sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const sessionData = JSON.parse(sessionCookie);
    const userId = sessionData.uid;
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    // Get all sessions for this user
    const sessionsRef = db.collection(getCollectionName('userSessions'));
    const snapshot = await sessionsRef
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('lastActiveAt', 'desc')
      .get();
    
    const currentSessionId = cookieStore.get('sessionId')?.value;
    
    const sessions: UserSession[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        deviceInfo: data.deviceInfo,
        createdAt: data.createdAt,
        lastActiveAt: data.lastActiveAt,
        ipAddress: data.ipAddress,
        isCurrentSession: doc.id === currentSessionId,
      };
    });
    
    return NextResponse.json({ sessions });
    
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/auth/sessions - Create a new session (called during login)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const sessionData = JSON.parse(sessionCookie);
    const userId = sessionData.uid;
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    const body = await request.json();
    const { userAgent } = body as SessionCreateData;
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    const sessionId = generateSessionId();
    const ipAddress = getClientIP(request);
    const deviceInfo = parseUserAgent(userAgent || request.headers.get('user-agent') || '');
    
    const newSession = {
      userId,
      deviceInfo: {
        userAgent: userAgent || request.headers.get('user-agent') || '',
        ...deviceInfo,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress,
      isActive: true,
    };
    
    // Store session in Firestore
    await db.collection(getCollectionName('userSessions')).doc(sessionId).set(newSession);
    
    // Set session ID cookie
    const response = NextResponse.json({ sessionId, success: true });
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    return response;
    
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/sessions - Revoke a specific session
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const sessionData = JSON.parse(sessionCookie);
    const userId = sessionData.uid;
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const sessionIdToRevoke = searchParams.get('sessionId');
    
    if (!sessionIdToRevoke) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    // Verify the session belongs to the current user
    const sessionDoc = await db.collection(getCollectionName('userSessions')).doc(sessionIdToRevoke).get();
    
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const sessionDocData = sessionDoc.data();
    if (sessionDocData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Mark session as inactive instead of deleting (for audit trail)
    await db.collection(getCollectionName('userSessions')).doc(sessionIdToRevoke).update({
      isActive: false,
      revokedAt: new Date().toISOString(),
      revokedBy: userId,
    });
    
    console.log(`Session ${sessionIdToRevoke} revoked by user ${userId}`);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
