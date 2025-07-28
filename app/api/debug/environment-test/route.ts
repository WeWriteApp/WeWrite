import { NextResponse } from 'next/server';
import { getEnvironmentType, getCollectionName, logEnvironmentConfig } from '../../../utils/environmentConfig';
import { getEnvironmentContext } from '../../../utils/environmentDetection';

export async function GET() {
  try {
    // Log environment config for debugging
    logEnvironmentConfig();
    
    const envType = getEnvironmentType();
    const context = getEnvironmentContext();
    
    const result = {
      environmentType: envType,
      context,
      collections: {
        users: getCollectionName('users'),
        pages: getCollectionName('pages'),
        subscriptions: getCollectionName('subscriptions')
      },
      explanation: {
        localhost: 'Uses DEV_ prefixed collections',
        vercelDev: 'Uses production collections (no prefix)',
        vercelMain: 'Uses production collections (no prefix)'
      }
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Environment test error:', error);
    return NextResponse.json(
      { error: 'Failed to get environment info' },
      { status: 500 }
    );
  }
}
