import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '../../../firebase/database';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Platform fee percentage (10%)
const PLATFORM_FEE_PERCENTAGE = 10;

/**
 * Process payouts for all creators
 * This endpoint should be called by a scheduled function at the end of each month
 */
export async function POST(request) {
  try {
    // Verify API key for security (this should be a secure key only known to your backend)
    const { headers } = request;
    const apiKey = headers.get('x-api-key');
    
    if (apiKey !== process.env.PAYOUT_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get all pledges grouped by page
    const pledgesSnapshot = await getDocs(collection(db, 'pledges'));
    
    // Group pledges by pageId
    const pledgesByPage = {};
    pledgesSnapshot.forEach(pledgeDoc => {
      const pledge = pledgeDoc.data();
      if (!pledgesByPage[pledge.pageId]) {
        pledgesByPage[pledge.pageId] = [];
      }
      pledgesByPage[pledge.pageId].push({
        id: pledgeDoc.id,
        ...pledge
      });
    });
    
    // Process payouts for each page
    const payoutResults = [];
    const batch = writeBatch(db);
    
    for (const pageId in pledgesByPage) {
      try {
        const pageDoc = await getDoc(doc(db, 'pages', pageId));
        
        if (!pageDoc.exists()) {
          console.error(`Page ${pageId} not found, skipping payouts`);
          continue;
        }
        
        const pageData = pageDoc.data();
        const creatorId = pageData.userId;
        
        // Skip if no creator ID
        if (!creatorId) {
          console.error(`No creator ID found for page ${pageId}, skipping payouts`);
          continue;
        }
        
        // Get creator data
        const creatorDoc = await getDoc(doc(db, 'users', creatorId));
        
        if (!creatorDoc.exists()) {
          console.error(`Creator ${creatorId} not found, skipping payouts`);
          continue;
        }
        
        const creatorData = creatorDoc.data();
        
        // Skip if creator doesn't have a Stripe Connect account or payouts not enabled
        if (!creatorData.stripeConnectAccountId || !creatorData.payoutEnabled) {
          console.error(`Creator ${creatorId} doesn't have an active Stripe Connect account, skipping payouts`);
          continue;
        }
        
        // Calculate total amount for this page
        const pledges = pledgesByPage[pageId];
        const totalAmount = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
        
        // Skip if total amount is 0
        if (totalAmount <= 0) {
          console.log(`No funds to transfer for page ${pageId}, skipping`);
          continue;
        }
        
        // Calculate platform fee
        const platformFee = (totalAmount * PLATFORM_FEE_PERCENTAGE) / 100;
        const creatorAmount = totalAmount - platformFee;
        
        // Convert to cents for Stripe
        const amountInCents = Math.round(creatorAmount * 100);
        
        // Create a transfer to the creator's Stripe Connect account
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: creatorData.stripeConnectAccountId,
          description: `Monthly payout for page: ${pageData.title || pageId}`,
          metadata: {
            pageId,
            creatorId,
            pledgeCount: pledges.length,
            platformFee: platformFee.toFixed(2)
          }
        });
        
        // Create a payout record in Firestore
        const payoutRef = doc(collection(db, 'payouts'));
        batch.set(payoutRef, {
          pageId,
          creatorId,
          amount: creatorAmount,
          platformFee,
          totalAmount,
          pledgeCount: pledges.length,
          stripeTransferId: transfer.id,
          status: 'completed',
          createdAt: serverTimestamp(),
          payoutDate: Timestamp.fromDate(new Date())
        });
        
        // Add to results
        payoutResults.push({
          pageId,
          creatorId,
          amount: creatorAmount,
          platformFee,
          totalAmount,
          pledgeCount: pledges.length,
          transferId: transfer.id,
          status: 'completed'
        });
      } catch (pageError) {
        console.error(`Error processing payout for page ${pageId}:`, pageError);
        payoutResults.push({
          pageId,
          error: pageError.message,
          status: 'failed'
        });
      }
    }
    
    // Commit all the payout records
    await batch.commit();
    
    return NextResponse.json({
      success: true,
      payouts: payoutResults
    });
  } catch (error) {
    console.error('Error processing payouts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payouts' },
      { status: 500 }
    );
  }
}

/**
 * Get payout history for a creator
 */
export async function GET(request) {
  try {
    // Get creator ID from query params
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    
    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }
    
    // Query payouts for this creator
    const payoutsQuery = query(
      collection(db, 'payouts'),
      where('creatorId', '==', creatorId)
    );
    
    const payoutsSnapshot = await getDocs(payoutsQuery);
    
    const payouts = [];
    payoutsSnapshot.forEach(doc => {
      payouts.push({
        id: doc.id,
        ...doc.data(),
        // Convert timestamps to ISO strings for JSON serialization
        createdAt: doc.data().createdAt?.toDate().toISOString() || null,
        payoutDate: doc.data().payoutDate?.toDate().toISOString() || null
      });
    });
    
    return NextResponse.json({ payouts });
  } catch (error) {
    console.error('Error getting payout history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get payout history' },
      { status: 500 }
    );
  }
}
