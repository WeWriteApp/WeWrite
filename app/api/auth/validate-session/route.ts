import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdmin } from "../../../firebase/firebaseAdmin";
import { getCollectionName } from "../../../utils/environmentConfig";
import { parseSignedCookieValue, type SessionCookieData } from "../../../utils/cookieUtils";

// Validate a session by checking if the session cookie exists and is valid
// Also checks if the session has been revoked from another device
export async function GET(request: NextRequest) {
  try {
    // Get the session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("simpleUserSession");
    const sessionIdCookie = cookieStore.get("sessionId");

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { valid: false, error: "No session found" },
        { status: 401 }
      );
    }

    // Parse the session data using signed cookie parser (supports both signed and legacy formats)
    const sessionData = await parseSignedCookieValue<SessionCookieData>(sessionCookie.value);

    if (!sessionData) {
      return NextResponse.json(
        { valid: false, error: "Invalid session format" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!sessionData.uid || !sessionData.email) {
      return NextResponse.json(
        { valid: false, error: "Incomplete session data" },
        { status: 401 }
      );
    }

    // Check if the session has been revoked (only if we have a sessionId)
    let sessionRevoked = false;
    let newDeviceDetected = false;

    if (sessionIdCookie?.value) {
      try {
        const admin = getFirebaseAdmin();
        if (admin) {
          const db = admin.firestore();
          const sessionDoc = await db
            .collection(getCollectionName('userSessions'))
            .doc(sessionIdCookie.value)
            .get();

          if (sessionDoc.exists) {
            const data = sessionDoc.data();
            if (data?.isActive === false) {
              sessionRevoked = true;
            }
          }

          // Check if there are newer active sessions (new device login)
          // This is informational only - we no longer log out the user
          const newerSessions = await db
            .collection(getCollectionName('userSessions'))
            .where('userId', '==', sessionData.uid)
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(2)
            .get();

          if (newerSessions.docs.length > 1) {
            const currentSessionCreatedAt = sessionDoc.exists
              ? sessionDoc.data()?.createdAt
              : null;

            // Check if there's a session newer than the current one
            for (const doc of newerSessions.docs) {
              if (doc.id !== sessionIdCookie.value) {
                const otherSessionCreatedAt = doc.data().createdAt;
                if (otherSessionCreatedAt > currentSessionCreatedAt) {
                  newDeviceDetected = true;
                  break;
                }
              }
            }
          }
        }
      } catch {
        // Don't fail validation if we can't check revocation status
      }
    }

    // If session was explicitly revoked, return invalid
    if (sessionRevoked) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'session_revoked',
          error: "Your session was signed out from another device"
        },
        { status: 401 }
      );
    }

    // Return the session data along with validation status
    // Include newDeviceDetected flag so the client can show a notification
    return NextResponse.json({
      valid: true,
      newDeviceDetected,
      user: {
        uid: sessionData.uid,
        email: sessionData.email,
        username: sessionData.username || null,
        emailVerified: sessionData.emailVerified || false,
      },
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Session validation failed" },
      { status: 500 }
    );
  }
}

// POST: Refresh session data (optional - can update session with latest user data)
export async function POST(request: NextRequest) {

  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "ID token required" },
        { status: 400 }
      );
    }

    // Import verifyIdToken from firebase-rest
    const { verifyIdToken, getFirestoreDoc } = await import("../../../lib/firebase-rest");
    const { getCollectionName } = await import("../../../utils/environmentConfig");
    
    const verifyResult = await verifyIdToken(idToken);
    
    if (!verifyResult.success || !verifyResult.uid) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Invalid token" },
        { status: 401 }
      );
    }

    // Get username from Firestore (using REST API with user's token)
    const userDoc = await getFirestoreDoc(getCollectionName("users"), verifyResult.uid);
    const username = userDoc?.username || null;

    // Update the session cookie with verified data
    const sessionData = {
      uid: verifyResult.uid,
      email: verifyResult.email || '',
      username: username,
      emailVerified: verifyResult.emailVerified || false,
    };

    const response = NextResponse.json({
      success: true,
      user: sessionData,
    });

    // Update the cookie
    response.cookies.set({
      name: "simpleUserSession",
      value: encodeURIComponent(JSON.stringify(sessionData)),
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Session refresh failed" },
      { status: 500 }
    );
  }
}
