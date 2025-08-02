import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET /api/auth/validate-session - Check if current session is still valid
 * This endpoint is called periodically to check if the session has been revoked
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession')?.value;
    const sessionId = cookieStore.get('sessionId')?.value;
    
    if (!sessionCookie || !sessionId) {
      return NextResponse.json({ valid: false, reason: 'No session found' });
    }
    
    const sessionData = JSON.parse(sessionCookie);
    const userId = sessionData.uid;
    
    if (!userId) {
      return NextResponse.json({ valid: false, reason: 'Invalid session data' });
    }
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    // Check if session still exists and is active
    const sessionDoc = await db.collection(getCollectionName('userSessions')).doc(sessionId).get();
    
    if (!sessionDoc.exists) {
      return NextResponse.json({ valid: false, reason: 'Session not found' });
    }
    
    const sessionDocData = sessionDoc.data();
    
    // Check if session is still active
    if (!sessionDocData?.isActive) {
      return NextResponse.json({ valid: false, reason: 'Session revoked' });
    }
    
    // Check if session belongs to the current user
    if (sessionDocData.userId !== userId) {
      return NextResponse.json({ valid: false, reason: 'Session mismatch' });
    }
    
    // Update last active time
    await db.collection(getCollectionName('userSessions')).doc(sessionId).update({
      lastActiveAt: new Date().toISOString(),
    });
    
    return NextResponse.json({ valid: true });
    
  } catch (error) {
    console.error('Error validating session:', error);
    return NextResponse.json({ valid: false, reason: 'Validation error' });
  }
}
