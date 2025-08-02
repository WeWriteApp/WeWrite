#!/usr/bin/env node

/**
 * Firestore Optimization Audit Script
 * 
 * Analyzes current Firestore usage patterns and provides optimization recommendations
 * for cost reduction and performance improvement.
 * 
 * Usage:
 *   node scripts/firestore-optimization-audit.js [--detailed] [--export-csv]
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
      
      if (jsonString.match(/^[A-Za-z0-9+/]+=*$/)) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
      }

      const serviceAccount = JSON.parse(jsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
      });
    } else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

// Helper function to get collection name based on environment
function getCollectionName(baseName) {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';
  return environment === 'production' ? baseName : `${baseName}_dev`;
}

/**
 * Analyze collection sizes and document counts
 */
async function analyzeCollectionSizes() {
  console.log('\n📊 COLLECTION SIZE ANALYSIS');
  console.log('─'.repeat(60));
  
  const collections = [
    'pages', 'users', 'pageViews', 'usdBalances', 'usdAllocations',
    'subscriptions', 'versions', 'tokenBalances', 'tokenAllocations',
    'writerUsdBalances', 'writerUsdEarnings', 'auditTrail'
  ];
  
  const results = [];
  
  for (const collectionName of collections) {
    try {
      const envCollectionName = getCollectionName(collectionName);
      const snapshot = await db.collection(envCollectionName).count().get();
      const count = snapshot.data().count;
      
      // Sample a few documents to estimate average size
      const sampleSnapshot = await db.collection(envCollectionName).limit(5).get();
      let avgSize = 0;
      if (!sampleSnapshot.empty) {
        const totalSize = sampleSnapshot.docs.reduce((sum, doc) => {
          return sum + JSON.stringify(doc.data()).length;
        }, 0);
        avgSize = Math.round(totalSize / sampleSnapshot.docs.length);
      }
      
      const estimatedTotalSize = count * avgSize;
      
      results.push({
        collection: collectionName,
        documentCount: count,
        avgDocSize: avgSize,
        estimatedTotalSize,
        priority: count > 10000 ? 'HIGH' : count > 1000 ? 'MEDIUM' : 'LOW'
      });
      
      console.log(`📁 ${collectionName.padEnd(20)} | ${count.toString().padStart(8)} docs | ${avgSize.toString().padStart(6)} bytes avg | Priority: ${results[results.length - 1].priority}`);
      
    } catch (error) {
      console.log(`❌ ${collectionName.padEnd(20)} | Error: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Analyze query patterns and identify expensive operations
 */
async function analyzeQueryPatterns() {
  console.log('\n🔍 QUERY PATTERN ANALYSIS');
  console.log('─'.repeat(60));
  
  const issues = [];
  
  // Check for potential full collection scans
  const largeCollections = ['pages', 'pageViews', 'users'];
  
  for (const collection of largeCollections) {
    try {
      const envCollectionName = getCollectionName(collection);
      
      // Test query without date filter (this would be expensive)
      console.log(`🔍 Analyzing ${collection} query patterns...`);
      
      // Check if we have proper indexes for common queries
      if (collection === 'pages') {
        // Test common page queries
        const recentQuery = db.collection(envCollectionName)
          .where('lastModified', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .orderBy('lastModified', 'desc')
          .limit(1);
        
        const start = Date.now();
        await recentQuery.get();
        const queryTime = Date.now() - start;
        
        if (queryTime > 1000) {
          issues.push({
            collection,
            issue: 'Slow recent pages query',
            queryTime,
            recommendation: 'Add composite index for lastModified + isPublic'
          });
        }
        
        console.log(`  ✅ Recent pages query: ${queryTime}ms`);
      }
      
    } catch (error) {
      issues.push({
        collection,
        issue: 'Query failed',
        error: error.message,
        recommendation: 'Check index configuration'
      });
    }
  }
  
  return issues;
}

/**
 * Analyze caching opportunities
 */
async function analyzeCachingOpportunities() {
  console.log('\n💾 CACHING OPPORTUNITIES ANALYSIS');
  console.log('─'.repeat(60));
  
  const opportunities = [];
  
  // Check for frequently accessed but rarely changed data
  const staticDataCollections = ['users', 'subscriptions'];
  
  for (const collection of staticDataCollections) {
    try {
      const envCollectionName = getCollectionName(collection);
      
      // Sample recent documents to check update frequency
      const recentDocs = await db.collection(envCollectionName)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();
      
      if (!recentDocs.empty) {
        const now = Date.now();
        const updateTimes = recentDocs.docs.map(doc => {
          const updatedAt = doc.data().updatedAt;
          if (updatedAt && updatedAt.toDate) {
            return now - updatedAt.toDate().getTime();
          }
          return null;
        }).filter(Boolean);
        
        const avgTimeSinceUpdate = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
        const hoursSinceUpdate = avgTimeSinceUpdate / (1000 * 60 * 60);
        
        if (hoursSinceUpdate > 1) {
          opportunities.push({
            collection,
            avgHoursSinceUpdate: Math.round(hoursSinceUpdate),
            recommendation: `Cache for ${Math.min(Math.round(hoursSinceUpdate / 4), 60)} minutes`,
            priority: hoursSinceUpdate > 24 ? 'HIGH' : 'MEDIUM'
          });
        }
        
        console.log(`📊 ${collection}: Avg ${Math.round(hoursSinceUpdate)}h since update - ${hoursSinceUpdate > 1 ? 'CACHE CANDIDATE' : 'FREQUENTLY UPDATED'}`);
      }
      
    } catch (error) {
      console.log(`❌ ${collection}: Error analyzing update patterns`);
    }
  }
  
  return opportunities;
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(collectionAnalysis, queryIssues, cachingOpportunities) {
  console.log('\n🎯 OPTIMIZATION RECOMMENDATIONS');
  console.log('─'.repeat(60));
  
  const recommendations = [];
  
  // High-priority collection optimizations
  const highPriorityCollections = collectionAnalysis.filter(c => c.priority === 'HIGH');
  if (highPriorityCollections.length > 0) {
    recommendations.push({
      category: 'Collection Optimization',
      priority: 'HIGH',
      title: 'Optimize Large Collections',
      description: `Collections with >10k documents: ${highPriorityCollections.map(c => c.collection).join(', ')}`,
      actions: [
        'Implement data archiving for old documents',
        'Add TTL (Time To Live) for temporary data',
        'Consider data partitioning by date/user'
      ]
    });
  }
  
  // Query optimization
  if (queryIssues.length > 0) {
    recommendations.push({
      category: 'Query Optimization',
      priority: 'HIGH',
      title: 'Fix Slow Queries',
      description: `${queryIssues.length} slow or failing queries detected`,
      actions: queryIssues.map(issue => `${issue.collection}: ${issue.recommendation}`)
    });
  }
  
  // Caching recommendations
  const highPriorityCaching = cachingOpportunities.filter(c => c.priority === 'HIGH');
  if (highPriorityCaching.length > 0) {
    recommendations.push({
      category: 'Caching Strategy',
      priority: 'MEDIUM',
      title: 'Implement Aggressive Caching',
      description: `${highPriorityCaching.length} collections suitable for long-term caching`,
      actions: highPriorityCaching.map(opp => 
        `Cache ${opp.collection} for ${opp.recommendation.split('Cache for ')[1]}`
      )
    });
  }
  
  // Always recommend these best practices
  recommendations.push({
    category: 'Best Practices',
    priority: 'MEDIUM',
    title: 'Implement Standard Optimizations',
    description: 'Industry-standard Firestore optimizations',
    actions: [
      'Batch write operations (up to 500 per batch)',
      'Use pagination for large result sets',
      'Implement read-through caching with Redis/Memcached',
      'Add monitoring for query performance',
      'Use offline persistence for mobile clients'
    ]
  });
  
  return recommendations;
}

/**
 * Main audit function
 */
async function runAudit() {
  const args = process.argv.slice(2);
  const detailed = args.includes('--detailed');
  const exportCsv = args.includes('--export-csv');
  
  console.log('🔍 FIRESTORE OPTIMIZATION AUDIT');
  console.log(`Environment: ${process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'}`);
  console.log(`Detailed Analysis: ${detailed ? 'YES' : 'NO'}`);
  console.log('═'.repeat(60));
  
  try {
    const startTime = Date.now();
    
    // Run all analyses
    const [collectionAnalysis, queryIssues, cachingOpportunities] = await Promise.all([
      analyzeCollectionSizes(),
      analyzeQueryPatterns(),
      analyzeCachingOpportunities()
    ]);
    
    // Generate recommendations
    const recommendations = generateRecommendations(collectionAnalysis, queryIssues, cachingOpportunities);
    
    // Display recommendations
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.title} [${rec.priority}]`);
      console.log(`   Category: ${rec.category}`);
      console.log(`   ${rec.description}`);
      rec.actions.forEach(action => console.log(`   • ${action}`));
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Audit completed in ${duration}ms`);
    
    // Export results if requested
    if (exportCsv) {
      const csvData = collectionAnalysis.map(c => 
        `${c.collection},${c.documentCount},${c.avgDocSize},${c.estimatedTotalSize},${c.priority}`
      ).join('\n');
      
      fs.writeFileSync('firestore-audit-results.csv', 
        'Collection,DocumentCount,AvgDocSize,EstimatedTotalSize,Priority\n' + csvData
      );
      console.log('📄 Results exported to firestore-audit-results.csv');
    }
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
runAudit().then(() => {
  console.log('\n✅ Audit completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
