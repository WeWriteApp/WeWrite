/**
 * Test Login API
 * 
 * This endpoint tests the login functionality to ensure that development
 * authentication only accepts predefined test users and rejects production
 * usernames/emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '../../../firebase/auth';
import { isDevelopmentAuthActive } from '../../../firebase/authWrapper';

// POST endpoint - Test login functionality
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailOrUsername, password, testType } = body;
    
    console.log(`🧪 Testing login: ${testType} with ${emailOrUsername}`);
    
    const isDev = isDevelopmentAuthActive();
    
    if (!isDev) {
      return NextResponse.json({
        error: 'Development auth not active',
        message: 'This test endpoint only works with development authentication enabled'
      }, { status: 400 });
    }
    
    try {
      const result = await loginUser(emailOrUsername, password);
      
      // If we get here, login was successful
      return NextResponse.json({
        testType,
        success: true,
        result: {
          user: {
            uid: result.user?.uid,
            email: result.user?.email,
            displayName: result.user?.displayName
          }
        },
        message: 'Login successful',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Login failed - this is expected for non-test users
      return NextResponse.json({
        testType,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Login failed as expected',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error in test login API:', error);
    
    return NextResponse.json({
      error: 'Test execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint - Get test scenarios
export async function GET(request: NextRequest) {
  try {
    const isDev = isDevelopmentAuthActive();
    
    if (!isDev) {
      return NextResponse.json({
        error: 'Development auth not active',
        message: 'This test endpoint only works with development authentication enabled'
      }, { status: 400 });
    }
    
    const testScenarios = [
      {
        name: 'Valid Test User Email',
        emailOrUsername: 'test1@wewrite.dev',
        password: 'testpass123',
        expectedResult: 'success',
        description: 'Should successfully log in with test user email'
      },
      {
        name: 'Valid Test User Username',
        emailOrUsername: 'testuser1',
        password: 'testpass123',
        expectedResult: 'success',
        description: 'Should successfully log in with test user username'
      },
      {
        name: 'Valid Test Admin Email',
        emailOrUsername: 'admin@wewrite.dev',
        password: 'adminpass123',
        expectedResult: 'success',
        description: 'Should successfully log in with test admin email'
      },
      {
        name: 'Valid Test Admin Username',
        emailOrUsername: 'testadmin',
        password: 'adminpass123',
        expectedResult: 'success',
        description: 'Should successfully log in with test admin username'
      },
      {
        name: 'Production Username (Should Fail)',
        emailOrUsername: 'jamiegray',
        password: 'anypassword',
        expectedResult: 'failure',
        description: 'Should reject production username and not access production data'
      },
      {
        name: 'Production Email (Should Fail)',
        emailOrUsername: 'contact@jamiegray.net',
        password: 'anypassword',
        expectedResult: 'failure',
        description: 'Should reject production email and not access production data'
      },
      {
        name: 'Invalid Test User Password',
        emailOrUsername: 'test1@wewrite.dev',
        password: 'wrongpassword',
        expectedResult: 'failure',
        description: 'Should reject test user with wrong password'
      },
      {
        name: 'Non-existent User',
        emailOrUsername: 'nonexistent@example.com',
        password: 'anypassword',
        expectedResult: 'failure',
        description: 'Should reject non-existent user'
      }
    ];
    
    return NextResponse.json({
      isDevelopmentAuth: isDev,
      testScenarios,
      instructions: {
        runTest: 'POST to this endpoint with { "emailOrUsername": "...", "password": "...", "testType": "..." }',
        expectedBehavior: 'Only predefined test users should be able to log in',
        securityNote: 'Production usernames/emails should be completely rejected'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in test login scenarios API:', error);
    
    return NextResponse.json({
      error: 'Failed to get test scenarios',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
