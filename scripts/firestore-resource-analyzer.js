#!/usr/bin/env node

/**
 * Firestore Resource Analyzer
 * 
 * Comprehensive analysis of Firestore usage using Firebase CLI and Admin SDK
 * to identify what's consuming database reads and costs.
 * 
 * Features:
 * - Collection size analysis
 * - Query pattern analysis  
 * - Index usage monitoring
 * - Read operation tracking
 * - Cost projection
 */

const admin = require('firebase-admin');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
      let keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';
      
      console.log(`🔑 Using service account from ${keySource}`);
      
      if (jsonString.match(/^[A-Za-z0-9+/]+=*$/)) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
        console.log('📦 Decoded base64-encoded service account');
      }

      const serviceAccount = JSON.parse(jsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID
      });
      
      console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);
      console.log(`📧 Service account: ${serviceAccount.client_email}`);
    } else {
      console.log('🔧 Using default credentials...');
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82'
      });
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.error('💡 Make sure you have GOOGLE_CLOUD_KEY_JSON environment variable set');
    process.exit(1);
  }
}

const db = admin.firestore();
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';

/**
 * Analyze collection sizes and document counts
 */
async function analyzeCollectionSizes() {
  console.log('\n📊 COLLECTION SIZE ANALYSIS');
  console.log('=' .repeat(50));
  
  const collections = [
    'pages', 'users', 'subscriptions', 'allocations', 'earnings',
    'DEV_pages', 'DEV_users', 'DEV_subscriptions', 'DEV_allocations', 'DEV_earnings'
  ];
  
  const results = [];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).count().get();
      const count = snapshot.data().count;
      
      // Estimate storage size (rough calculation)
      const estimatedSize = count * 2; // Assume ~2KB per document average
      const readCost = count * 0.00036 / 1000; // Firestore read pricing
      
      results.push({
        collection: collectionName,
        documents: count,
        estimatedSizeKB: estimatedSize,
        estimatedReadCost: readCost.toFixed(6)
      });
      
      console.log(`📁 ${collectionName.padEnd(20)} | ${count.toString().padStart(8)} docs | ~${estimatedSize}KB | $${readCost.toFixed(6)}`);
    } catch (error) {
      console.log(`❌ ${collectionName.padEnd(20)} | Error: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Analyze subcollection usage
 */
async function analyzeSubcollections() {
  console.log('\n🗂️  SUBCOLLECTION ANALYSIS');
  console.log('=' .repeat(50));
  
  try {
    // Check user subcollections
    const usersSnapshot = await db.collection('users').limit(5).get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 User: ${userId}`);
      
      // Check subscriptions subcollection
      try {
        const subsSnapshot = await db.collection(`users/${userId}/subscriptions`).count().get();
        console.log(`  💳 Subscriptions: ${subsSnapshot.data().count}`);
      } catch (error) {
        console.log(`  💳 Subscriptions: Error - ${error.message}`);
      }
      
      // Check allocations subcollection  
      try {
        const allocSnapshot = await db.collection(`users/${userId}/allocations`).count().get();
        console.log(`  💰 Allocations: ${allocSnapshot.data().count}`);
      } catch (error) {
        console.log(`  💰 Allocations: Error - ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error analyzing subcollections:', error.message);
  }
}

/**
 * Check Firebase CLI for additional insights
 */
function checkFirebaseCLI() {
  console.log('\n🔧 FIREBASE CLI ANALYSIS');
  console.log('=' .repeat(50));
  
  try {
    // Check if Firebase CLI is installed
    execSync('firebase --version', { stdio: 'pipe' });
    console.log('✅ Firebase CLI is installed');
    
    // Try to get project info
    try {
      const projectInfo = execSync(`firebase projects:list --json`, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      const projects = JSON.parse(projectInfo);
      const currentProject = projects.find(p => p.projectId === projectId);
      
      if (currentProject) {
        console.log(`📋 Project: ${currentProject.displayName} (${currentProject.projectId})`);
        console.log(`🏷️  Project Number: ${currentProject.projectNumber}`);
      }
    } catch (error) {
      console.log('⚠️  Could not fetch project info via CLI');
    }
    
    // Try to get Firestore usage stats (requires proper permissions)
    try {
      console.log('\n📈 Attempting to fetch Firestore usage stats...');
      const usageStats = execSync(`gcloud firestore operations list --project=${projectId} --limit=10 --format=json`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      const operations = JSON.parse(usageStats);
      console.log(`🔄 Recent operations: ${operations.length}`);
      
      operations.slice(0, 3).forEach((op, index) => {
        console.log(`  ${index + 1}. ${op.name} - ${op.metadata?.operationType || 'Unknown'}`);
      });
    } catch (error) {
      console.log('⚠️  Could not fetch Firestore operations (may require additional permissions)');
    }
    
  } catch (error) {
    console.log('❌ Firebase CLI not installed or not configured');
    console.log('💡 Install with: npm install -g firebase-tools');
    console.log('💡 Login with: firebase login');
  }
}

/**
 * Analyze query patterns by examining recent documents
 */
async function analyzeQueryPatterns() {
  console.log('\n🔍 QUERY PATTERN ANALYSIS');
  console.log('=' .repeat(50));
  
  try {
    // Analyze pages collection for common query patterns
    const pagesSnapshot = await db.collection('pages')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    console.log(`📄 Analyzed ${pagesSnapshot.size} recent pages`);
    
    // Count pages by user
    const pagesByUser = {};
    const pagesByDate = {};
    
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Count by user
      const userId = data.userId || 'unknown';
      pagesByUser[userId] = (pagesByUser[userId] || 0) + 1;
      
      // Count by date
      if (data.createdAt) {
        const date = data.createdAt.toDate().toISOString().split('T')[0];
        pagesByDate[date] = (pagesByDate[date] || 0) + 1;
      }
    });
    
    console.log('\n👥 Top users by page count:');
    Object.entries(pagesByUser)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([userId, count]) => {
        console.log(`  ${userId.substring(0, 20).padEnd(20)} | ${count} pages`);
      });
    
    console.log('\n📅 Recent activity by date:');
    Object.entries(pagesByDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
      .forEach(([date, count]) => {
        console.log(`  ${date} | ${count} pages`);
      });
      
  } catch (error) {
    console.error('❌ Error analyzing query patterns:', error.message);
  }
}

/**
 * Generate cost projections
 */
function generateCostProjections(collectionResults) {
  console.log('\n💰 COST PROJECTIONS');
  console.log('=' .repeat(50));
  
  const totalDocs = collectionResults.reduce((sum, result) => sum + result.documents, 0);
  const totalReadCost = collectionResults.reduce((sum, result) => sum + parseFloat(result.estimatedReadCost), 0);
  
  console.log(`📊 Total documents: ${totalDocs.toLocaleString()}`);
  console.log(`💸 Cost per full read: $${totalReadCost.toFixed(6)}`);
  console.log(`📈 Daily cost (10 full reads): $${(totalReadCost * 10).toFixed(4)}`);
  console.log(`📈 Monthly cost (300 full reads): $${(totalReadCost * 300).toFixed(2)}`);
  
  // Identify most expensive collections
  const sortedByDocs = [...collectionResults].sort((a, b) => b.documents - a.documents);
  
  console.log('\n🔥 Most expensive collections by document count:');
  sortedByDocs.slice(0, 5).forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.collection} - ${result.documents.toLocaleString()} docs`);
  });
}

/**
 * Main analysis function
 */
async function runAnalysis() {
  console.log('🔍 FIRESTORE RESOURCE ANALYZER');
  console.log('=' .repeat(50));
  console.log(`📅 Analysis started: ${new Date().toISOString()}`);
  console.log(`🎯 Project: ${projectId}`);
  
  try {
    // Run all analyses
    const collectionResults = await analyzeCollectionSizes();
    await analyzeSubcollections();
    await analyzeQueryPatterns();
    checkFirebaseCLI();
    generateCostProjections(collectionResults);
    
    console.log('\n✅ Analysis complete!');
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('  1. Focus optimization on collections with highest document counts');
    console.log('  2. Implement caching for frequently accessed data');
    console.log('  3. Consider pagination for large result sets');
    console.log('  4. Monitor query patterns to identify optimization opportunities');
    console.log('  5. Use composite indexes for complex queries');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the analysis
runAnalysis();
