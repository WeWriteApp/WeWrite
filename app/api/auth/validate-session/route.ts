import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserById } from "../../../lib/firebase-rest";

// Validate a session by checking if the user still exists and is active
export async function GET(request: NextRequest) {
  console.log("[validate-session] GET request received");

  try {
    // Get the session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("simpleUserSession");

    if (!sessionCookie?.value) {
      console.log("[validate-session] No session cookie found");
      return NextResponse.json(
        { valid: false, error: "No session found" },
        { status: 401 }
      );
    }

    // Parse the session data
    let sessionData;
    try {
      sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
    } catch (parseError) {
      console.error("[validate-session] Failed to parse session cookie:", parseError);
      return NextResponse.json(
        { valid: false, error: "Invalid session format" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!sessionData.uid || !sessionData.email) {
      console.log("[validate-session] Session missing required fields");
      return NextResponse.json(
        { valid: false, error: "Incomplete session data" },
        { status: 401 }
      );
    }

    console.log(`[validate-session] Validating session for uid: ${sessionData.uid}`);

    // Verify the user still exists in Firebase Auth using REST API
    const userResult = await getUserById(sessionData.uid);
    
    if (!userResult.success || !userResult.user) {
      console.log(`[validate-session] User not found or error: ${userResult.error}`);
      return NextResponse.json(
        { valid: false, error: "User not found" },
        { status: 401 }
      );
    }

    const user = userResult.user;

    // Check if user is disabled
    if (user.disabled) {
      console.log(`[validate-session] User ${sessionData.uid} is disabled`);
      return NextResponse.json(
        { valid: false, error: "User account is disabled" },
        { status: 401 }
      );
    }

    console.log(`[validate-session] Session valid for user: ${sessionData.email}`);

    // Return the session data along with validation status
    return NextResponse.json({
      valid: true,
      user: {
        uid: sessionData.uid,
        email: sessionData.email,
        username: sessionData.username || null,
        emailVerified: sessionData.emailVerified || user.emailVerified || false,
      },
    });
  } catch (error: unknown) {
    console.error("[validate-session] Error validating session:", error);
    return NextResponse.json(
      { valid: false, error: "Session validation failed" },
      { status: 500 }
    );
  }
}

// POST: Refresh session data (optional - can update session with latest user data)
export async function POST(request: NextRequest) {
  console.log("[validate-session] POST request received");

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
    const { verifyIdToken } = await import("../../../lib/firebase-rest");
    
    const verifyResult = await verifyIdToken(idToken);
    
    if (!verifyResult.success || !verifyResult.uid) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Invalid token" },
        { status: 401 }
      );
    }

    // Get current user data
    const userResult = await getUserById(verifyResult.uid);
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.user;

    // Check if user is disabled
    if (user.disabled) {
      return NextResponse.json(
        { success: false, error: "User account is disabled" },
        { status: 401 }
      );
    }

    // Get username from Firestore
    const { getFirestoreDocument } = await import("../../../lib/firebase-rest");
    const usernameDoc = await getFirestoreDocument("usernames", verifyResult.uid);
    const username = usernameDoc.success ? usernameDoc.data?.username : null;

    // Update the session cookie
    const sessionData = {
      uid: verifyResult.uid,
      email: user.email || verifyResult.email,
      username: username,
      emailVerified: user.emailVerified || false,
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
  } catch (error: unknown) {
    console.error("[validate-session] Error refreshing session:", error);
    return NextResponse.json(
      { success: false, error: "Session refresh failed" },
      { status: 500 }
    );
  }
}
