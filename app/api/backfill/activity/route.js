import { NextResponse } from 'next/server';
import { backfillActivityCalendar } from '../../../scripts/backfillActivityCalendar';
import { auth } from '../../../firebase/auth';

/**
 * API route to trigger activity calendar backfill
 * This is protected and only accessible to authenticated users
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let targetUserId = null;
    try {
      const body = await request.json();
      targetUserId = body?.targetUserId || null;
    } catch (e) {
      // If body parsing fails, just use null (process all users)
      console.log('No request body or invalid JSON, processing all users');
    }

    // If targetUserId is provided, only process that user
    // Otherwise, process the current user
    const userIdToProcess = targetUserId || userId;

    console.log(`Running backfill for user: ${userIdToProcess}`);

    // Run the backfill
    const result = await backfillActivityCalendar(userIdToProcess);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully processed activity data`
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in backfill API route:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
