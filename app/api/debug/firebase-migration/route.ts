/**
 * Firebase Migration Debug API
 * 
 * This endpoint provides comprehensive validation and testing for the
 * Firebase migration architecture. It validates environment detection,
 * collection naming, and migration readiness.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  validateMigrationReadiness, 
  generateMigrationDocumentation,
  runMigrationValidation 
} from '../../../utils/firebaseMigrationValidator';
import { 
  getEnvironmentType, 
  getCollectionName, 
  logEnvironmentConfig,
  COLLECTIONS 
} from '../../../utils/environmentConfig';
import { 
  getEnvironmentContext, 
  logEnvironmentDetection 
} from '../../../utils/environmentDetection';

// GET endpoint - Validate Firebase migration setup
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Firebase Migration Debug API called');
    
    // Get environment information
    const envType = getEnvironmentType();
    const envContext = getEnvironmentContext();
    
    // Run comprehensive validation
    const validationResult = validateMigrationReadiness();
    
    // Generate collection mapping
    const collectionMapping = Object.fromEntries(
      Object.entries(COLLECTIONS).map(([key, baseName]) => [
        key,
        {
          baseName,
          environmentSpecificName: getCollectionName(baseName),
          currentEnvironment: envType
        }
      ])
    );
    
    // Generate migration documentation
    const migrationDocs = generateMigrationDocumentation();
    
    // Log detailed information to server console
    console.log('\n=== Firebase Migration Debug ===');
    logEnvironmentDetection();
    logEnvironmentConfig();
    runMigrationValidation();
    console.log('================================\n');
    
    // Prepare response data
    const responseData = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        context: envContext
      },
      validation: validationResult,
      collections: {
        mapping: collectionMapping,
        totalCollections: Object.keys(COLLECTIONS).length,
        exampleUsage: {
          users: getCollectionName('users'),
          pages: getCollectionName('pages'),
          subscriptions: getCollectionName('subscriptions'),
          versions: getCollectionName('versions')
        }
      },
      migration: {
        isReady: validationResult.isValid,
        documentation: migrationDocs,
        nextSteps: validationResult.isValid 
          ? ['Setup separate Firebase projects', 'Update environment configurations', 'Test data separation']
          : ['Fix validation errors', 'Resolve environment issues', 'Re-run validation']
      },
      testing: {
        environmentDetection: 'Environment detection system active',
        collectionHelpers: 'Environment-aware collection helpers active',
        firebaseConfig: 'Environment-aware Firebase config active',
        validationSystem: 'Migration validation system active'
      }
    };
    
    // Return success response
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Error in Firebase migration debug API:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// POST endpoint - Test specific migration scenarios
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, parameters } = body;
    
    console.log(`🧪 Testing migration scenario: ${testType}`);
    
    let testResult;
    
    switch (testType) {
      case 'collection-naming':
        testResult = await testCollectionNaming(parameters);
        break;
        
      case 'environment-detection':
        testResult = await testEnvironmentDetection(parameters);
        break;
        
      case 'firebase-config':
        testResult = await testFirebaseConfig(parameters);
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
    
    return NextResponse.json({
      testType,
      parameters,
      result: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in migration test:', error);
    
    return NextResponse.json({
      error: 'Test execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Test collection naming functionality
 */
async function testCollectionNaming(parameters: any) {
  const { collections } = parameters || {};
  const testCollections = collections || ['users', 'pages', 'versions'];
  
  const results = testCollections.map((collectionName: string) => {
    const environmentSpecificName = getCollectionName(collectionName);
    return {
      baseName: collectionName,
      environmentSpecificName,
      environment: getEnvironmentType(),
      isCorrect: environmentSpecificName.includes(collectionName)
    };
  });
  
  return {
    success: true,
    results,
    summary: {
      totalTested: results.length,
      allCorrect: results.every(r => r.isCorrect)
    }
  };
}

/**
 * Test environment detection functionality
 */
async function testEnvironmentDetection(parameters: any) {
  const context = getEnvironmentContext();
  const envType = getEnvironmentType();
  
  return {
    success: true,
    detectedEnvironment: envType,
    context,
    environmentVariables: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasFirebaseConfig: !!(process.env.NEXT_PUBLIC_FIREBASE_PID)
    },
    validation: {
      isConsistent: context.type === envType,
      hasRequiredVars: !!(process.env.NODE_ENV && process.env.NEXT_PUBLIC_FIREBASE_PID)
    }
  };
}

/**
 * Test Firebase configuration functionality
 */
async function testFirebaseConfig(parameters: any) {
  try {
    const { getFirebaseConfig } = await import('../../../utils/environmentConfig');
    const config = getFirebaseConfig();
    
    return {
      success: true,
      hasConfig: !!config,
      projectId: config.projectId,
      hasRequiredFields: !!(config.apiKey && config.authDomain && config.projectId),
      environment: getEnvironmentType()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
