import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

// Initialize Firebase Admin SDK
let adminApp;
try {
  adminApp = getApps().find(app => app.name === 'jamie-debug-app');
  if (!adminApp) {
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    
    adminApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
      })
    }, 'jamie-debug-app');
  }
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
}

const adminDb = getFirestore(adminApp);

export async function GET() {
  try {
    const jamieUserId = 'fWNeCuussPgYgkN2LGohFRCPXiy1';
    
    // Get environment info
    const { getEnvironmentType, logEnvironmentConfig } = await import('../../../utils/environmentConfig');
    logEnvironmentConfig();
    
    const envType = getEnvironmentType();
    const usersCollection = getCollectionName('users');
    
    // Get user data
    const userDoc = await adminDb.collection(usersCollection).doc(jamieUserId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get subscription data using the same logic as recent-edits API
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS,
      jamieUserId,
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );
    
    const subscriptionDoc = await adminDb.doc(parentPath).collection(subCollectionName).doc('current').get();
    const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;
    
    // Calculate effective tier
    const effectiveTier = getEffectiveTier(
      subscriptionData?.amount || null,
      subscriptionData?.tier || null,
      subscriptionData?.status || null
    );
    
    const isActive = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';
    
    return NextResponse.json({
      environmentType: envType,
      jamieUserId,
      collections: {
        users: usersCollection,
        subscriptions: getCollectionName('subscriptions')
      },
      paths: {
        userPath: `${usersCollection}/${jamieUserId}`,
        subscriptionPath: `${parentPath}/${subCollectionName}/current`
      },
      userData: {
        exists: userDoc.exists,
        username: userData?.username,
        email: userData?.email
      },
      subscriptionData: {
        exists: subscriptionDoc.exists,
        raw: subscriptionData,
        amount: subscriptionData?.amount,
        status: subscriptionData?.status,
        tier: subscriptionData?.tier
      },
      calculated: {
        effectiveTier,
        isActive,
        hasActiveSubscription: isActive,
        subscriptionAmount: subscriptionData?.amount || null
      }
    });
  } catch (error) {
    console.error('Jamie subscription debug error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jamie subscription data', details: error.message },
      { status: 500 }
    );
  }
}
