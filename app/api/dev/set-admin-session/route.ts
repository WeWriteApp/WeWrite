import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * DEV ONLY: Set admin session cookie for development
 * This creates a dev_admin_user session for testing admin functionality
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    console.log('🔧 Setting dev admin session...');
    
    const cookieStore = await cookies();
    
    // Set the simple session cookie to dev_admin_user (legacy format)
    cookieStore.set('simpleUserSession', 'dev_admin_user', {
      httpOnly: true,
      secure: false, // Not secure in development
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    console.log('✅ Dev admin session cookie set');

    return NextResponse.json({
      success: true,
      message: 'Dev admin session created',
      userId: 'dev_admin_user',
      userEmail: 'jamie@wewrite.app',
      note: 'You can now access admin endpoints'
    });
    
  } catch (error) {
    console.error('❌ Error setting dev admin session:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to set dev admin session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
