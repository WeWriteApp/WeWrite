/**
 * Session Management API
 * 
 * This endpoint handles session creation for both development and production
 * authentication, ensuring proper environment separation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getEnvironmentType } from '../../../utils/environmentConfig';
import { cookies } from 'next/headers';

interface SessionRequest {
  user: {
    uid: string;
    email: string;
    username?: string;
    emailVerified: boolean;
  };
  isDevelopment?: boolean;
}

// POST endpoint - Create user session
export async function POST(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isDevelopment = envType === 'development' && process.env.USE_DEV_AUTH === 'true';
    
    console.log(`[Session API] Creating session - Environment: ${envType}, Dev Auth: ${isDevelopment}`);

    const body = await request.json();
    const { user, isDevelopment: requestIsDev } = body as SessionRequest;

    // Validate required fields
    if (!user || !user.uid || !user.email) {
      return createErrorResponse('BAD_REQUEST', 'User data is required');
    }

    // Ensure development sessions are only created in development environment
    if (requestIsDev && !isDevelopment) {
      return createErrorResponse('FORBIDDEN', 'Development sessions not allowed in production');
    }

    // Ensure production sessions are not created with development auth active
    if (!requestIsDev && isDevelopment) {
      return createErrorResponse('FORBIDDEN', 'Production sessions not allowed with development auth active');
    }

    const cookieStore = await cookies();
    
    // Create session data
    const sessionData = {
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      isDevelopment: requestIsDev || false,
      createdAt: new Date().toISOString()
    };

    // Set session cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 // 24 hours for development, 1 hour for production
    };

    if (isDevelopment) {
      // Development session - longer expiry for easier testing
      cookieStore.set('devUserSession', JSON.stringify(sessionData), {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 // 24 hours
      });
      
      console.log(`[Session API] Development session created for: ${user.username} (${user.email})`);
    } else {
      // Production session
      cookieStore.set('userSession', JSON.stringify(sessionData), {
        ...cookieOptions,
        maxAge: 60 * 60 // 1 hour
      });
      
      console.log(`[Session API] Production session created for: ${user.email}`);
    }

    return createApiResponse({
      success: true,
      session: {
        uid: user.uid,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        isDevelopment: requestIsDev || false
      },
      message: isDevelopment ? 'Development session created' : 'Production session created'
    });
    
  } catch (error) {
    console.error('Session creation error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create session');
  }
}

// GET endpoint - Get current session
export async function GET(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isDevelopment = envType === 'development' && process.env.USE_DEV_AUTH === 'true';
    
    const cookieStore = await cookies();

    let sessionCookie;
    if (isDevelopment) {
      sessionCookie = cookieStore.get('devUserSession');
    } else {
      sessionCookie = cookieStore.get('userSession');
    }

    if (!sessionCookie) {
      return createErrorResponse('UNAUTHORIZED', 'No active session');
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value);
      
      return createApiResponse({
        isAuthenticated: true,
        session: sessionData,
        environment: envType,
        isDevelopment
      });
      
    } catch (parseError) {
      // Invalid session data, clear cookie
      if (isDevelopment) {
        cookieStore.delete('devUserSession');
      } else {
        cookieStore.delete('userSession');
      }
      
      return createErrorResponse('UNAUTHORIZED', 'Invalid session data');
    }
    
  } catch (error) {
    console.error('Session retrieval error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve session');
  }
}

// DELETE endpoint - Clear session
export async function DELETE(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isDevelopment = envType === 'development' && process.env.USE_DEV_AUTH === 'true';
    
    const cookieStore = await cookies();
    
    // Clear both development and production session cookies
    cookieStore.delete('devUserSession');
    cookieStore.delete('userSession');
    cookieStore.delete('authToken');
    
    console.log(`[Session API] Session cleared - Environment: ${envType}`);
    
    return createApiResponse({
      success: true,
      message: 'Session cleared successfully'
    });
    
  } catch (error) {
    console.error('Session clearing error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to clear session');
  }
}
