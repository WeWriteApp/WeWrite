import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { reducePledgeAmount } from '../../../services/pledgeBudgetService';

/**
 * POST /api/tokens/pledge
 * Update pledge amount for a specific pledge
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, tokenChange, newAmount } = body;

    // Validate input
    if (!pageId) {
      return NextResponse.json({
        error: 'Page ID is required'
      }, { status: 400 });
    }

    if (typeof tokenChange !== 'number' && typeof newAmount !== 'number') {
      return NextResponse.json({
        error: 'Either tokenChange or newAmount must be provided'
      }, { status: 400 });
    }

    // Handle direct amount setting vs. change
    if (typeof newAmount === 'number') {
      // Direct amount setting (used by pledge management)
      const success = await reducePledgeAmount(userId, pageId, newAmount);

      if (!success) {
        return NextResponse.json({
          error: 'Failed to update pledge amount'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Pledge amount updated successfully'
      });
    }

    // Legacy token change logic (for backward compatibility)
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Find the user's pledge for this page
    const pledgeRef = db.collection('users').doc(userId).collection('pledges').doc(pageId);
    const pledgeDoc = await pledgeRef.get();

    if (!pledgeDoc.exists) {
      return NextResponse.json({
        error: 'Pledge not found'
      }, { status: 404 });
    }

    const pledgeData = pledgeDoc.data();
    const currentAmount = pledgeData.amount || 0;
    const finalAmount = Math.max(0, currentAmount + tokenChange);

    // Update the pledge amount
    await pledgeRef.update({
      amount: finalAmount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      pledgeId: pageId,
      previousAmount: currentAmount,
      newAmount: newAmount,
      change: tokenChange,
      message: 'Pledge updated successfully'
    });

  } catch (error: any) {
    console.error('Error in pledge update API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update pledge',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tokens/pledge?pageId=xxx
 * Get current pledge amount for a page
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ 
        error: 'Page ID is required' 
      }, { status: 400 });
    }

    // Get the user's pledge for this page
    const pledgeRef = doc(db, 'users', userId, 'pledges', pageId);
    const pledgeDoc = await getDoc(pledgeRef);

    if (!pledgeDoc.exists()) {
      return NextResponse.json({
        pageId,
        amount: 0,
        exists: false
      });
    }

    const pledgeData = pledgeDoc.data();

    return NextResponse.json({
      pageId,
      amount: pledgeData.amount || 0,
      exists: true,
      createdAt: pledgeData.createdAt,
      updatedAt: pledgeData.updatedAt
    });

  } catch (error) {
    console.error('Error getting pledge:', error);
    return NextResponse.json(
      { error: 'Failed to get pledge' },
      { status: 500 }
    );
  }
}