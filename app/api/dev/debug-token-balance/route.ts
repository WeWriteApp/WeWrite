/**
 * Debug endpoint to check token balance data
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'dev_test_user_2';

    console.log('Checking token balance for:', userId);

    // Check token balance document
    const balanceRef = doc(db, getCollectionName("tokenBalances"), userId);
    const balanceDoc = await getDoc(balanceRef);

    if (balanceDoc.exists()) {
      const data = balanceDoc.data();
      console.log('Token balance data:', data);
      
      return NextResponse.json({
        success: true,
        userId,
        exists: true,
        data
      });
    } else {
      console.log('No token balance document found');
      
      return NextResponse.json({
        success: true,
        userId,
        exists: false,
        message: 'No token balance document found'
      });
    }

  } catch (error) {
    console.error('Error checking token balance:', error);
    return NextResponse.json({
      error: 'Failed to check token balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
