import { NextRequest, NextResponse } from 'next/server';
import { getPreferencesByToken, updatePreferencesByToken } from '../../../services/emailSettingsTokenService';

/**
 * GET /api/email/preferences?token=xxx
 * Get email preferences using a token (no login required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const result = await getPreferencesByToken(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: result.preferences,
      userData: result.userData,
    });

  } catch (error) {
    console.error('[API] Error getting email preferences by token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/preferences
 * Update email preferences using a token (no login required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, preferences } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Preferences object is required' },
        { status: 400 }
      );
    }

    const result = await updatePreferencesByToken(token, preferences);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Error updating email preferences by token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
