/**
 * Schema Optimization Utility for Firebase Cost Reduction
 * 
 * Provides tools for optimizing document structure, denormalization,
 * and data organization to minimize read costs and improve performance.
 */

import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  type DocumentData 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from './environmentConfig';

interface OptimizationResult {
  documentsProcessed: number;
  bytesReduced: number;
  readsReduced: number;
  costSavings: number;
  errors: string[];
}

interface DenormalizationConfig {
  sourceCollection: string;
  targetCollection: string;
  sourceField: string;
  targetFields: string[];
  batchSize?: number;
}

/**
 * Document size analyzer
 */
export const analyzeDocumentSize = (data: DocumentData): {
  sizeBytes: number;
  largeFields: string[];
  recommendations: string[];
} => {
  const jsonString = JSON.stringify(data);
  const sizeBytes = new Blob([jsonString]).size;
  const largeFields: string[] = [];
  const recommendations: string[] = [];

  // Analyze individual fields
  for (const [key, value] of Object.entries(data)) {
    const fieldSize = new Blob([JSON.stringify(value)]).size;
    
    if (fieldSize > 10000) { // 10KB threshold
      largeFields.push(`${key} (${Math.round(fieldSize / 1024)}KB)`);
      
      if (key === 'content' && fieldSize > 50000) {
        recommendations.push(`Move large content field to subcollection for ${key}`);
      } else if (Array.isArray(value) && value.length > 100) {
        recommendations.push(`Consider paginating large array field: ${key}`);
      } else if (typeof value === 'object' && fieldSize > 20000) {
        recommendations.push(`Consider flattening or splitting large object field: ${key}`);
      }
    }
  }

  // Overall document recommendations
  if (sizeBytes > 100000) { // 100KB
    recommendations.push('Document exceeds 100KB - consider splitting into multiple documents');
  } else if (sizeBytes > 50000) { // 50KB
    recommendations.push('Document is large - monitor for performance impact');
  }

  return {
    sizeBytes,
    largeFields,
    recommendations
  };
};

/**
 * Optimize page documents by moving large content to subcollections
 */
export const optimizePageDocuments = async (
  pageIds?: string[]
): Promise<OptimizationResult> => {
  const result: OptimizationResult = {
    documentsProcessed: 0,
    bytesReduced: 0,
    readsReduced: 0,
    costSavings: 0,
    errors: []
  };

  try {
    let pagesQuery;
    
    if (pageIds && pageIds.length > 0) {
      // Process specific pages
      pagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('__name__', 'in', pageIds.slice(0, 10)) // Firestore limit
      );
    } else {
      // Find pages with large content
      pagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('contentSize', '>', 50000) // 50KB threshold
      );
    }

    const snapshot = await getDocs(pagesQuery);
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const pageDoc of snapshot.docs) {
      const pageData = pageDoc.data();
      const analysis = analyzeDocumentSize(pageData);

      if (analysis.sizeBytes > 50000 && pageData.content) {
        // Move content to subcollection
        const contentRef = doc(
          collection(db, getCollectionName('pages'), pageDoc.id, 'content'),
          'main'
        );

        // Add content to subcollection
        batch.set(contentRef, {
          content: pageData.content,
          updatedAt: new Date().toISOString()
        });

        // Update main document (remove content, add reference)
        const optimizedPageData = { ...pageData };
        delete optimizedPageData.content;
        optimizedPageData.hasContentSubcollection = true;
        optimizedPageData.contentSize = analysis.sizeBytes;

        batch.update(doc(db, getCollectionName('pages'), pageDoc.id), optimizedPageData);

        result.bytesReduced += analysis.sizeBytes * 0.7; // Estimate 70% reduction
        result.readsReduced += 1; // One less read for page metadata queries
        batchCount++;

        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }

      result.documentsProcessed++;
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }

    // Calculate cost savings (approximate)
    result.costSavings = (result.readsReduced * 0.00036) + (result.bytesReduced / 1024 / 1024 * 0.18);

  } catch (error) {
    result.errors.push(`Page optimization error: ${error.message}`);
  }

  return result;
};

/**
 * Implement denormalization for frequently accessed data
 */
export const implementDenormalization = async (
  config: DenormalizationConfig
): Promise<OptimizationResult> => {
  const result: OptimizationResult = {
    documentsProcessed: 0,
    bytesReduced: 0,
    readsReduced: 0,
    costSavings: 0,
    errors: []
  };

  try {
    const { sourceCollection, targetCollection, sourceField, targetFields, batchSize = 100 } = config;

    // Get all target documents that need denormalization
    const targetQuery = query(
      collection(db, getCollectionName(targetCollection)),
      where(sourceField, '!=', null)
    );

    const targetSnapshot = await getDocs(targetQuery);
    const sourceIds = [...new Set(targetSnapshot.docs.map(doc => doc.data()[sourceField]))];

    // Batch process source documents
    for (let i = 0; i < sourceIds.length; i += 10) { // Firestore 'in' limit
      const batchIds = sourceIds.slice(i, i + 10);
      
      const sourceQuery = query(
        collection(db, getCollectionName(sourceCollection)),
        where('__name__', 'in', batchIds)
      );

      const sourceSnapshot = await getDocs(sourceQuery);
      const sourceData = new Map();

      sourceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const denormalizedData: any = {};
        
        targetFields.forEach(field => {
          if (data[field] !== undefined) {
            denormalizedData[field] = data[field];
          }
        });

        sourceData.set(doc.id, denormalizedData);
      });

      // Update target documents with denormalized data
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const targetDoc of targetSnapshot.docs) {
        const targetData = targetDoc.data();
        const sourceId = targetData[sourceField];
        const denormalizedData = sourceData.get(sourceId);

        if (denormalizedData) {
          batch.update(doc(db, getCollectionName(targetCollection), targetDoc.id), denormalizedData);
          batchCount++;
          result.readsReduced += targetFields.length; // Estimate reads saved per document

          if (batchCount >= batchSize) {
            await batch.commit();
            batchCount = 0;
          }
        }

        result.documentsProcessed++;
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    // Calculate cost savings
    result.costSavings = result.readsReduced * 0.00036; // $0.36 per 100K reads

  } catch (error) {
    result.errors.push(`Denormalization error: ${error.message}`);
  }

  return result;
};

/**
 * Create optimized indexes for common query patterns
 */
export const generateIndexRecommendations = (
  collectionName: string,
  queryPatterns: Array<{
    filters: string[];
    orderBy?: string;
    frequency: number;
  }>
): Array<{
  fields: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedCostReduction: number;
}> => {
  const recommendations: Array<{
    fields: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedCostReduction: number;
  }> = [];

  // Sort patterns by frequency
  const sortedPatterns = queryPatterns.sort((a, b) => b.frequency - a.frequency);

  for (const pattern of sortedPatterns) {
    const fields = [...pattern.filters];
    if (pattern.orderBy) {
      fields.push(pattern.orderBy);
    }

    // Calculate priority based on frequency and complexity
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (pattern.frequency > 100) priority = 'high';
    else if (pattern.frequency > 20) priority = 'medium';

    // Estimate cost reduction (higher for more frequent queries)
    const estimatedCostReduction = pattern.frequency * 0.001; // $0.001 per query optimized

    recommendations.push({
      fields,
      priority,
      estimatedCostReduction
    });
  }

  return recommendations;
};

/**
 * Analyze collection for optimization opportunities
 */
export const analyzeCollectionOptimization = async (
  collectionName: string,
  sampleSize: number = 100
): Promise<{
  totalDocuments: number;
  averageSize: number;
  largeDocuments: number;
  recommendations: string[];
  potentialSavings: number;
}> => {
  try {
    const collectionRef = collection(db, getCollectionName(collectionName));
    const sampleQuery = query(collectionRef, limit(sampleSize));
    const snapshot = await getDocs(sampleQuery);

    let totalSize = 0;
    let largeDocuments = 0;
    const recommendations: string[] = [];

    for (const doc of snapshot.docs) {
      const analysis = analyzeDocumentSize(doc.data());
      totalSize += analysis.sizeBytes;

      if (analysis.sizeBytes > 50000) {
        largeDocuments++;
      }

      recommendations.push(...analysis.recommendations);
    }

    const averageSize = totalSize / snapshot.size;
    const potentialSavings = largeDocuments * 0.001; // Estimate $0.001 savings per optimized document

    // Remove duplicate recommendations
    const uniqueRecommendations = [...new Set(recommendations)];

    return {
      totalDocuments: snapshot.size,
      averageSize,
      largeDocuments,
      recommendations: uniqueRecommendations,
      potentialSavings
    };

  } catch (error) {
    console.error(`Error analyzing collection ${collectionName}:`, error);
    return {
      totalDocuments: 0,
      averageSize: 0,
      largeDocuments: 0,
      recommendations: [`Error analyzing collection: ${error.message}`],
      potentialSavings: 0
    };
  }
};

/**
 * Optimize user data denormalization in pages
 */
export const optimizeUserDataDenormalization = async (): Promise<OptimizationResult> => {
  return implementDenormalization({
    sourceCollection: 'users',
    targetCollection: 'pages',
    sourceField: 'userId',
    targetFields: ['username', 'displayName', 'photoURL', 'subscriptionTier'],
    batchSize: 100
  });
};

/**
 * Get schema optimization report
 */
export const getSchemaOptimizationReport = async (): Promise<{
  collections: Array<{
    name: string;
    analysis: any;
  }>;
  totalPotentialSavings: number;
  priorityRecommendations: string[];
  estimatedMonthlySavings: number;
  optimizationScore: number;
}> => {
  const collections = ['pages', 'users', 'analytics_events', 'sessions', 'notifications'];
  const analyses = [];
  let totalPotentialSavings = 0;
  const priorityRecommendations: string[] = [];

  for (const collectionName of collections) {
    const analysis = await analyzeCollectionOptimization(collectionName);
    analyses.push({
      name: collectionName,
      analysis
    });
    totalPotentialSavings += analysis.potentialSavings;

    // Add high-priority recommendations
    if (analysis.largeDocuments > 10) {
      priorityRecommendations.push(`URGENT: Optimize ${collectionName}: ${analysis.largeDocuments} large documents detected (potential savings: $${analysis.potentialSavings.toFixed(4)})`);
    }

    if (analysis.averageSize > 100000) { // 100KB
      priorityRecommendations.push(`CRITICAL: ${collectionName} has very large average document size (${Math.round(analysis.averageSize / 1024)}KB)`);
    }
  }

  // Calculate optimization score (0-100)
  const totalDocuments = analyses.reduce((sum, a) => sum + a.analysis.totalDocuments, 0);
  const totalLargeDocuments = analyses.reduce((sum, a) => sum + a.analysis.largeDocuments, 0);
  const optimizationScore = totalDocuments > 0
    ? Math.max(0, 100 - (totalLargeDocuments / totalDocuments) * 100)
    : 100;

  // Estimate monthly savings (assuming current usage patterns)
  const estimatedMonthlySavings = totalPotentialSavings * 30; // Daily savings * 30 days

  // Add general recommendations based on overall analysis
  if (optimizationScore < 70) {
    priorityRecommendations.unshift('CRITICAL: Overall schema optimization score is low - immediate action required');
  }

  if (estimatedMonthlySavings > 10) {
    priorityRecommendations.unshift(`HIGH IMPACT: Potential monthly savings of $${estimatedMonthlySavings.toFixed(2)} available`);
  }

  return {
    collections: analyses,
    totalPotentialSavings,
    priorityRecommendations,
    estimatedMonthlySavings,
    optimizationScore: Math.round(optimizationScore)
  };
};
