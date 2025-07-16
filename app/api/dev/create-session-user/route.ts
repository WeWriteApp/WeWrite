import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Create a user profile for the current session user ID
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const sessionUserId = 'dev_test_user_1';
    
    console.log(`Creating user profile for session user: ${sessionUserId}`);

    // Create user profile in DEV_users collection
    const userProfile = {
      uid: sessionUserId,
      email: 'dev_test_user_1@wewrite.dev',
      username: 'dev_test_user_1',
      emailVerified: true,
      isDevelopment: true,
      isAdmin: false,
      bio: 'Development session user - created automatically',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      profileComplete: true,
      stats: {
        pagesCreated: 0,
        tokensEarned: 0,
        tokensSpent: 0,
        followersCount: 0,
        followingCount: 0
      }
    };

    // Create in DEV_users collection
    const userRef = db.collection(getCollectionName('users')).doc(sessionUserId);
    await userRef.set(userProfile);

    // Create username mapping in DEV_usernames collection
    const usernameRef = db.collection(getCollectionName('usernames')).doc('dev_test_user_1');
    await usernameRef.set({
      uid: sessionUserId,
      email: 'dev_test_user_1@wewrite.dev',
      username: 'dev_test_user_1',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Created user profile for ${sessionUserId}`);

    return NextResponse.json({
      success: true,
      message: `Created user profile for session user: ${sessionUserId}`,
      userProfile: {
        uid: sessionUserId,
        username: 'dev_test_user_1',
        email: 'dev_test_user_1@wewrite.dev'
      }
    });

  } catch (error) {
    console.error('Error creating session user:', error);
    return NextResponse.json({
      error: 'Failed to create session user',
      message: error.message
    }, { status: 500 });
  }
}
