import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface CreateTestAccountRequest {
  email?: string;
  username?: string;
  password?: string;
  makeAdmin?: boolean;
}

/**
 * Development endpoint to create a test account with email verification bypassed
 * Only works in development environment
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        error: 'This endpoint is only available in development'
      }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    const body = await request.json();
    const { 
      email = 'test@local.dev', 
      username = 'testuser', 
      password = 'TestPassword123!',
      makeAdmin = false
    } = body as CreateTestAccountRequest;

    console.log(`🚀 Creating test account: ${email} (${username})`);

    // Check if user already exists
    let userRecord;
    let isNewUser = false;
    
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('⚠️ User already exists, updating...');
      
      // Update existing user
      await auth.updateUser(userRecord.uid, {
        password,
        emailVerified: true
      });
      
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user in Firebase Auth...');
        isNewUser = true;
        
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: true,
          displayName: username
        });
        
        console.log('✅ User created in Firebase Auth');
      } else {
        throw error;
      }
    }

    // Create/update user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email,
      username,
      emailVerified: true,
      isAnonymous: false,
      isDevelopment: true,
      isAdmin: makeAdmin,
      bio: `Test account for local development${makeAdmin ? ' (Admin)' : ''}`,
      createdAt: isNewUser ? new Date().toISOString() : undefined,
      lastLoginAt: new Date().toISOString(),
      profileComplete: true,
      pageCount: 0,
      followerCount: 0,
      viewCount: 0,
      stats: {
        pagesCreated: 0,
        tokensEarned: 0,
        tokensSpent: 0,
        followersCount: 0,
        followingCount: 0
      }
    };

    // Remove undefined values
    Object.keys(userProfile).forEach(key => {
      if (userProfile[key] === undefined) {
        delete userProfile[key];
      }
    });

    await db.collection(getCollectionName('users')).doc(userRecord.uid).set(userProfile, { merge: true });
    console.log('✅ User profile created/updated in Firestore');

    // Create/update username mapping
    await db.collection(getCollectionName('usernames')).doc(username).set({
      uid: userRecord.uid,
      email,
      username,
      createdAt: new Date().toISOString()
    });
    console.log('✅ Username mapping created/updated');

    return NextResponse.json({
      success: true,
      message: `Test account ${isNewUser ? 'created' : 'updated'} successfully`,
      account: {
        uid: userRecord.uid,
        email,
        username,
        isAdmin: makeAdmin,
        isNewUser,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/login`
      },
      credentials: {
        email,
        password,
        username
      }
    });

  } catch (error: any) {
    console.error('❌ Error creating test account:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create test account'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check if test accounts exist
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        error: 'This endpoint is only available in development'
      }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const auth = admin.auth();

    const testEmails = ['test@local.dev', 'jamie@wewrite.app', 'test@wewrite.app'];
    const accounts = [];

    for (const email of testEmails) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        accounts.push({
          email,
          uid: userRecord.uid,
          emailVerified: userRecord.emailVerified,
          exists: true
        });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          accounts.push({
            email,
            exists: false
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      accounts,
      instructions: {
        create: 'POST to this endpoint with { "email": "your@email.com", "username": "yourusername" }',
        login: 'Use the credentials to log in at /auth/login'
      }
    });

  } catch (error: any) {
    console.error('❌ Error checking test accounts:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
