import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../firebase/admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
initAdmin();

// Get auth and firestore instances
const auth = getAuth();
const db = getFirestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// POST /api/cleanup-subscriptions - One-time cleanup of subscription data
export async function POST(request: NextRequest) {
  try {
    // Check for admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all users with subscriptions
    const subscriptionsSnapshot = await db.collection('subscriptions').get();
    const userSubscriptionsSnapshot = await db.collection('users').get();

    const results = {
      processed: 0,
      fixed: 0,
      errors: 0,
      details: [] as string[]
    };

    // Process API path subscriptions
    for (const doc of subscriptionsSnapshot.docs) {
      try {
        const userId = doc.id;
        const subscriptionData = doc.data();
        results.processed++;

        // Check if this is a valid subscription
        let needsFixing = false;
        let fixedData = { ...subscriptionData };

        // Ensure required fields have values
        if (fixedData.status === undefined) {
          fixedData.status = 'canceled';
          needsFixing = true;
        }

        if (fixedData.amount === undefined) {
          fixedData.amount = 0;
          needsFixing = true;
        }

        if (fixedData.tier === undefined) {
          fixedData.tier = null;
          needsFixing = true;
        }

        if (fixedData.stripeSubscriptionId === undefined) {
          fixedData.stripeSubscriptionId = null;
          needsFixing = true;
        }

        // If status is active but no stripeSubscriptionId, set to canceled
        if (fixedData.status === 'active' && !fixedData.stripeSubscriptionId) {
          fixedData.status = 'canceled';
          fixedData.tier = null;
          fixedData.amount = 0;
          fixedData.canceledAt = new Date().toISOString();
          needsFixing = true;
        }

        // If needs fixing, update the data
        if (needsFixing) {
          // Update the API path
          await db.collection('subscriptions').doc(userId).set(fixedData, { merge: true });

          // Update the user path
          const userSubRef = db.collection('users').doc(userId).collection('subscription').doc('current');
          await userSubRef.set(fixedData, { merge: true });

          results.fixed++;
          results.details.push(`Fixed subscription for user ${userId}`);
        }

        // Ensure data exists in user path
        const userSubRef = db.collection('users').doc(userId).collection('subscription').doc('current');
        const userSubDoc = await userSubRef.get();

        if (!userSubDoc.exists) {
          await userSubRef.set(fixedData);
          results.fixed++;
          results.details.push(`Copied subscription data to user path for ${userId}`);
        }
      } catch (error: any) {
        results.errors++;
        results.details.push(`Error processing subscription: ${error.message}`);
      }
    }

    // Process user path subscriptions
    for (const userDoc of userSubscriptionsSnapshot.docs) {
      try {
        const userId = userDoc.id;
        
        // Check if user has a subscription
        const userSubRef = db.collection('users').doc(userId).collection('subscription').doc('current');
        const userSubDoc = await userSubRef.get();
        
        if (userSubDoc.exists) {
          const subscriptionData = userSubDoc.data();
          if (!subscriptionData) continue;
          
          results.processed++;
          
          // Check if this is a valid subscription
          let needsFixing = false;
          let fixedData = { ...subscriptionData };
          
          // Ensure required fields have values
          if (fixedData.status === undefined) {
            fixedData.status = 'canceled';
            needsFixing = true;
          }
          
          if (fixedData.amount === undefined) {
            fixedData.amount = 0;
            needsFixing = true;
          }
          
          if (fixedData.tier === undefined) {
            fixedData.tier = null;
            needsFixing = true;
          }
          
          if (fixedData.stripeSubscriptionId === undefined) {
            fixedData.stripeSubscriptionId = null;
            needsFixing = true;
          }
          
          // If status is active but no stripeSubscriptionId, set to canceled
          if (fixedData.status === 'active' && !fixedData.stripeSubscriptionId) {
            fixedData.status = 'canceled';
            fixedData.tier = null;
            fixedData.amount = 0;
            fixedData.canceledAt = new Date().toISOString();
            needsFixing = true;
          }
          
          // If needs fixing, update the data
          if (needsFixing) {
            // Update the user path
            await userSubRef.set(fixedData, { merge: true });
            
            results.fixed++;
            results.details.push(`Fixed subscription in user path for ${userId}`);
          }
        }
      } catch (error: any) {
        results.errors++;
        results.details.push(`Error processing user subscription: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription cleanup completed',
      results
    });
  } catch (error: any) {
    console.error('Error cleaning up subscriptions:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      success: false
    }, { status: 500 });
  }
}
