import { NextResponse } from 'next/server';
import { db } from '../../../firebase/database';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  doc
} from 'firebase/firestore';

// Platform fee percentage (10%)
const PLATFORM_FEE_PERCENTAGE = 10;

/**
 * Get estimated earnings for a creator
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
    
    // Get all pages owned by this creator
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', creatorId)
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    
    if (pagesSnapshot.empty) {
      return NextResponse.json({
        currentMonth: 0,
        estimated: 0,
        pageCount: 0,
        donorCount: 0
      });
    }
    
    // Get page IDs
    const pageIds = [];
    pagesSnapshot.forEach(doc => {
      pageIds.push(doc.id);
    });
    
    // Get all pledges for these pages
    const pledges = [];
    const uniqueDonors = new Set();
    
    for (const pageId of pageIds) {
      const pledgesQuery = query(
        collection(db, 'pledges'),
        where('pageId', '==', pageId)
      );
      
      const pledgesSnapshot = await getDocs(pledgesQuery);
      
      pledgesSnapshot.forEach(doc => {
        const pledge = doc.data();
        pledges.push({
          id: doc.id,
          ...pledge
        });
        
        if (pledge.userId) {
          uniqueDonors.add(pledge.userId);
        }
      });
    }
    
    // Calculate total pledged amount
    const totalPledged = pledges.reduce((sum, pledge) => sum + (pledge.amount || 0), 0);
    
    // Calculate platform fee
    const platformFee = (totalPledged * PLATFORM_FEE_PERCENTAGE) / 100;
    
    // Calculate creator earnings
    const creatorEarnings = totalPledged - platformFee;
    
    // Get current month payouts
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const payoutsQuery = query(
      collection(db, 'payouts'),
      where('creatorId', '==', creatorId)
    );
    
    const payoutsSnapshot = await getDocs(payoutsQuery);
    
    let currentMonthPayouts = 0;
    
    payoutsSnapshot.forEach(doc => {
      const payout = doc.data();
      if (payout.payoutDate) {
        const payoutDate = payout.payoutDate.toDate();
        if (payoutDate.getMonth() === currentMonth && payoutDate.getFullYear() === currentYear) {
          currentMonthPayouts += payout.amount || 0;
        }
      }
    });
    
    return NextResponse.json({
      currentMonth: currentMonthPayouts,
      estimated: creatorEarnings,
      pageCount: pageIds.length,
      donorCount: uniqueDonors.size
    });
  } catch (error) {
    console.error('Error calculating estimated earnings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate estimated earnings' },
      { status: 500 }
    );
  }
}
