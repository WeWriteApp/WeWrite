import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { DEV_TEST_USERS, getDevTestUserPassword } from "../../../utils/testUsers";
// Check if development environment
const isDevelopmentEnvironment = () => {
  return process.env.NODE_ENV === 'development';
};
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Development endpoint to initialize test user profiles in DEV_ collections
 * 
 * NOTE: This endpoint uses firebase-admin auth for user creation which is unavoidable.
 * This is acceptable because:
 * 1. It only runs in development environment
 * 2. Development doesn't have the Vercel serverless jose issues
 * 3. Creating Firebase Auth users REQUIRES admin.auth().createUser()
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (!isDevelopmentEnvironment()) {
      return NextResponse.json({
        error: 'This endpoint is only available in development'
      }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const results = [];

    // Create user profiles for each test user in DEV_ collections
    for (const [key, testUser] of Object.entries(DEV_TEST_USERS)) {
      try {
        console.log(`Creating test user: ${testUser.username} in Firebase Auth and DEV_ collections`);

        // First, create the user in Firebase Auth
        // Get password from environment variable (not hardcoded)
        const devPassword = getDevTestUserPassword();
        if (!devPassword) {
          throw new Error('DEV_TEST_USER_PASSWORD not set in environment');
        }

        let authUser;
        try {
          authUser = await admin.auth().createUser({
            uid: testUser.uid,
            email: testUser.email,
            password: devPassword,
            emailVerified: true
          });
          console.log(`✅ Created Firebase Auth user: ${testUser.username}`);
        } catch (authError: any) {
          if (authError.code === 'auth/uid-already-exists') {
            console.log(`⚠️ Firebase Auth user already exists: ${testUser.username}`);
            authUser = await admin.auth().getUser(testUser.uid);
          } else {
            throw authError;
          }
        }

        // User profile data
        const userProfile = {
          uid: testUser.uid,
          email: testUser.email,
          username: testUser.username,
          emailVerified: true,
          isDevelopment: true,
          isAdmin: testUser.isAdmin || false,
          bio: testUser.description || `Test user for development - ${testUser.username}`,
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

        // Create in environment-aware Firestore collection (DEV_users in development)
        const firestoreUserRef = db.collection(getCollectionName('users')).doc(testUser.uid);
        await firestoreUserRef.set(userProfile);

        // Create username mapping in DEV_usernames collection
        const usernameRef = db.collection(getCollectionName('usernames')).doc(testUser.username);
        await usernameRef.set({
          uid: testUser.uid,
          email: testUser.email,
          username: testUser.username,
          createdAt: new Date().toISOString()
        });

        results.push({
          user: key,
          uid: testUser.uid,
          username: testUser.username,
          status: 'created',
          firebaseAuth: 'created',
          firestoreProfile: 'created'
        });

        console.log(`✅ Created complete profile for ${testUser.username} in Firebase Auth and DEV_ collections`);

      } catch (error) {
        console.error(`❌ Error creating profile for ${testUser.username}:`, error);
        results.push({
          user: key,
          uid: testUser.uid,
          username: testUser.username,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test user profiles initialized in DEV_ collections',
      results,
      collections: {
        firestore_users: getCollectionName('users'),
        usernames: getCollectionName('usernames')
      }
    });

  } catch (error) {
    console.error('Error initializing test users:', error);
    return NextResponse.json({
      error: 'Failed to initialize test users',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
