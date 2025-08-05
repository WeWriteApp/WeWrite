import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { execSync } from 'child_process';
import { admin } from '../../../firebase/admin';

/**
 * Firebase Insights API
 * 
 * Combines internal monitoring with Firebase CLI insights
 * to provide comprehensive resource usage analysis
 */

interface CollectionStats {
  name: string;
  documentCount: number;
  estimatedSizeKB: number;
  estimatedReadCost: number;
  isProduction: boolean;
}

interface FirebaseInsights {
  projectInfo: {
    projectId: string;
    environment: string;
    timestamp: string;
  };
  collections: CollectionStats[];
  totalDocuments: number;
  estimatedMonthlyCost: number;
  recommendations: string[];
  cliAvailable: boolean;
  errors: string[];
}

/**
 * Analyze collection sizes and costs
 */
async function analyzeCollections(): Promise<CollectionStats[]> {
  const collections = [
    'pages', 'users', 'subscriptions', 'allocations', 'earnings',
    'DEV_pages', 'DEV_users', 'DEV_subscriptions', 'DEV_allocations', 'DEV_earnings'
  ];
  
  const results: CollectionStats[] = [];
  
  for (const collectionName of collections) {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection(collectionName).count().get();
      const count = snapshot.data().count;
      
      // Estimate storage size (rough calculation)
      const estimatedSize = count * 2; // Assume ~2KB per document average
      const readCost = count * 0.00036 / 1000; // Firestore read pricing
      
      results.push({
        name: collectionName,
        documentCount: count,
        estimatedSizeKB: estimatedSize,
        estimatedReadCost: readCost,
        isProduction: !collectionName.startsWith('DEV_')
      });
      
    } catch (error) {
      console.error(`Error analyzing collection ${collectionName}:`, error);
      results.push({
        name: collectionName,
        documentCount: 0,
        estimatedSizeKB: 0,
        estimatedReadCost: 0,
        isProduction: !collectionName.startsWith('DEV_')
      });
    }
  }
  
  return results;
}

/**
 * Check if Firebase CLI is available and get project info
 */
function getFirebaseCLIInfo(): { available: boolean; projectInfo?: any; error?: string } {
  try {
    // Check if Firebase CLI is installed
    execSync('firebase --version', { stdio: 'pipe' });
    
    // Try to get project info
    const projectInfo = execSync('firebase projects:list --json', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    return {
      available: true,
      projectInfo: JSON.parse(projectInfo)
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(collections: CollectionStats[]): string[] {
  const recommendations: string[] = [];
  
  // Find largest collections
  const sortedBySize = [...collections].sort((a, b) => b.documentCount - a.documentCount);
  const largestCollection = sortedBySize[0];
  
  if (largestCollection && largestCollection.documentCount > 10000) {
    recommendations.push(`Focus optimization on '${largestCollection.name}' collection (${largestCollection.documentCount.toLocaleString()} documents)`);
  }
  
  // Check for dev vs production usage
  const devCollections = collections.filter(c => c.name.startsWith('DEV_'));
  const prodCollections = collections.filter(c => !c.name.startsWith('DEV_'));
  
  const totalDevDocs = devCollections.reduce((sum, c) => sum + c.documentCount, 0);
  const totalProdDocs = prodCollections.reduce((sum, c) => sum + c.documentCount, 0);
  
  if (totalDevDocs > totalProdDocs * 0.1) {
    recommendations.push('Consider cleaning up development collections to reduce costs');
  }
  
  // General recommendations
  recommendations.push('Implement caching for frequently accessed data');
  recommendations.push('Use pagination for large result sets');
  recommendations.push('Consider composite indexes for complex queries');
  
  if (collections.some(c => c.documentCount > 50000)) {
    recommendations.push('Consider data archiving for old documents');
  }
  
  return recommendations;
}

/**
 * GET /api/monitoring/firebase-insights
 * Get comprehensive Firebase resource insights
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access
    const userId = await getUserIdFromRequest(request);
    
    console.log('🔍 Firebase Insights: Starting analysis...');
    
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
    const environment = process.env.NODE_ENV || 'development';
    
    // Analyze collections
    const collections = await analyzeCollections();
    
    // Get Firebase CLI info
    const cliInfo = getFirebaseCLIInfo();
    
    // Calculate totals
    const totalDocuments = collections.reduce((sum, c) => sum + c.documentCount, 0);
    const totalReadCost = collections.reduce((sum, c) => sum + c.estimatedReadCost, 0);
    const estimatedMonthlyCost = totalReadCost * 300; // Assume 300 full reads per month
    
    // Generate recommendations
    const recommendations = generateRecommendations(collections);
    
    const insights: FirebaseInsights = {
      projectInfo: {
        projectId,
        environment,
        timestamp: new Date().toISOString()
      },
      collections: collections.sort((a, b) => b.documentCount - a.documentCount),
      totalDocuments,
      estimatedMonthlyCost,
      recommendations,
      cliAvailable: cliInfo.available,
      errors: cliInfo.error ? [cliInfo.error] : []
    };
    
    console.log(`✅ Firebase Insights: Analysis complete - ${totalDocuments} total documents`);
    
    return NextResponse.json({
      success: true,
      insights,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting Firebase insights:', error);
    return NextResponse.json({
      error: 'Failed to get Firebase insights',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/firebase-insights
 * Trigger detailed analysis with Firebase CLI
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔧 Firebase Insights: Triggering detailed CLI analysis...');
    
    // Run the Firebase resource analyzer script
    try {
      const output = execSync('node scripts/firestore-resource-analyzer.js', {
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      });
      
      return NextResponse.json({
        success: true,
        message: 'Detailed analysis completed',
        output: output.split('\n').slice(-20), // Last 20 lines
        timestamp: new Date().toISOString()
      });
      
    } catch (scriptError) {
      return NextResponse.json({
        success: false,
        error: 'Script execution failed',
        details: scriptError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error triggering Firebase analysis:', error);
    return NextResponse.json({
      error: 'Failed to trigger analysis',
      details: error.message
    }, { status: 500 });
  }
}
