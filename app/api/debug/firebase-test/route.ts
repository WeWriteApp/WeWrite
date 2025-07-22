import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to test Firebase Admin initialization step by step
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Firebase Test] Starting Firebase Admin test...');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      steps: []
    };
    
    // Step 1: Check environment variables
    testResults.steps.push({
      step: 1,
      name: 'Environment Variables Check',
      success: true,
      data: {
        hasGoogleCloudKeyJson: !!process.env.GOOGLE_CLOUD_KEY_JSON,
        hasLoggingCloudKeyJson: !!process.env.LOGGING_CLOUD_KEY_JSON,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      }
    });
    
    // Step 2: Try to parse service account JSON
    let serviceAccount = null;
    try {
      if (process.env.GOOGLE_CLOUD_KEY_JSON) {
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
        
        // Handle base64 encoding
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
        }
        
        serviceAccount = JSON.parse(jsonString);
        
        testResults.steps.push({
          step: 2,
          name: 'Service Account JSON Parse',
          success: true,
          data: {
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            hasPrivateKey: !!serviceAccount.private_key,
            privateKeyLength: serviceAccount.private_key?.length || 0
          }
        });
      } else {
        throw new Error('No GOOGLE_CLOUD_KEY_JSON found');
      }
    } catch (error) {
      testResults.steps.push({
        step: 2,
        name: 'Service Account JSON Parse',
        success: false,
        error: error.message
      });
      
      return NextResponse.json(testResults, { status: 200 });
    }
    
    // Step 3: Try to initialize Firebase Admin
    try {
      const admin = await import('firebase-admin');
      
      // Check if already initialized
      if (admin.apps.length > 0) {
        testResults.steps.push({
          step: 3,
          name: 'Firebase Admin Already Initialized',
          success: true,
          data: {
            appsCount: admin.apps.length,
            projectId: admin.apps[0]?.options?.projectId
          }
        });
      } else {
        // Try to initialize
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
        });
        
        testResults.steps.push({
          step: 3,
          name: 'Firebase Admin Initialization',
          success: true,
          data: {
            projectId: app.options.projectId,
            databaseURL: app.options.databaseURL
          }
        });
      }
      
      // Step 4: Try to get Auth instance
      const auth = admin.auth();
      testResults.steps.push({
        step: 4,
        name: 'Firebase Admin Auth Instance',
        success: true,
        data: {
          hasAuth: !!auth,
          authType: typeof auth
        }
      });
      
      // Step 5: Try to create a test token (this will fail but shows if auth works)
      try {
        const testToken = await auth.createCustomToken('test-uid');
        testResults.steps.push({
          step: 5,
          name: 'Test Token Creation',
          success: true,
          data: {
            tokenLength: testToken.length
          }
        });
      } catch (tokenError) {
        testResults.steps.push({
          step: 5,
          name: 'Test Token Creation',
          success: false,
          error: tokenError.message,
          note: 'This might fail but shows if auth instance works'
        });
      }
      
    } catch (error) {
      testResults.steps.push({
        step: 3,
        name: 'Firebase Admin Initialization',
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(testResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Firebase Test] Error:', error);
    
    return NextResponse.json({
      error: 'Firebase test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
