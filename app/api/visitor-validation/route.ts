import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../utils/apiHelpers';

/**
 * POST /api/visitor-validation
 * 
 * Validate visitor data and detect suspicious patterns.
 * Environment-aware API replacement for VisitorValidationService direct Firebase calls.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const body = await request.json();
    const { visitorData, validationType = 'comprehensive' } = body;

    if (!visitorData) {
      return createErrorResponse('BAD_REQUEST', 'Visitor data is required');
    }

    console.log('🔍 [VISITOR VALIDATION] Starting validation', {
      type: validationType,
      fingerprintId: visitorData.fingerprintId
    });

    // Use environment-aware collection naming
    const visitorsRef = db.collection(getCollectionName('siteVisitors'));
    
    // Get recent visitor patterns for analysis
    const recentVisitorsQuery = visitorsRef
      .where('lastSeen', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .orderBy('lastSeen', 'desc')
      .limit(1000);

    const recentVisitorsSnapshot = await recentVisitorsQuery.get();

    // Analyze patterns
    const validation = await analyzeVisitorPatterns(visitorData, recentVisitorsSnapshot.docs);

    console.log('✅ [VISITOR VALIDATION] Validation completed', {
      isValid: validation.isValid,
      confidence: validation.confidence,
      issueCount: validation.issues.length
    });

    return createSuccessResponse({
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [VISITOR VALIDATION] Error validating visitor:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to validate visitor');
  }
}

/**
 * GET /api/visitor-validation/patterns
 * 
 * Get traffic patterns for analysis.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const includeDetails = searchParams.get('includeDetails') === 'true';

    console.log('📊 [VISITOR VALIDATION] Fetching traffic patterns', { hours });

    // Use environment-aware collection naming
    const visitorsRef = db.collection(getCollectionName('siteVisitors'));
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const patternsQuery = visitorsRef
      .where('lastSeen', '>=', startTime)
      .orderBy('lastSeen', 'desc');

    const snapshot = await patternsQuery.get();

    // Analyze patterns
    const patterns = analyzeTrafficPatterns(snapshot.docs, includeDetails);

    console.log('✅ [VISITOR VALIDATION] Traffic patterns analyzed', {
      totalVisitors: snapshot.size,
      patterns: patterns.length
    });

    return createSuccessResponse({
      patterns,
      totalVisitors: snapshot.size,
      timeRange: { hours, startTime: startTime.toISOString() },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [VISITOR VALIDATION] Error fetching patterns:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch traffic patterns');
  }
}

/**
 * Analyze visitor patterns for validation
 */
async function analyzeVisitorPatterns(visitorData: any, recentVisitors: any[]): Promise<any> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence = 1.0;

  // Basic validation checks
  if (!visitorData.fingerprintId) {
    issues.push('Missing fingerprint ID');
    confidence -= 0.3;
  }

  // Check for suspicious patterns
  const similarVisitors = recentVisitors.filter(doc => {
    const data = doc.data();
    return data.fingerprint?.id === visitorData.fingerprintId;
  });

  if (similarVisitors.length > 10) {
    issues.push('High frequency visits from same fingerprint');
    confidence -= 0.2;
    recommendations.push('Monitor for bot activity');
  }

  // Check bot indicators
  if (visitorData.isBot) {
    if (visitorData.botConfidence > 0.8) {
      issues.push('High bot confidence detected');
      confidence -= 0.4;
    }
    recommendations.push('Apply bot filtering');
  }

  // Check session patterns
  const sessionCount = similarVisitors.length;
  if (sessionCount > 50) {
    issues.push('Excessive session count');
    confidence -= 0.3;
    recommendations.push('Rate limit this visitor');
  }

  // Determine validity
  const isValid = confidence > 0.5 && issues.length < 3;

  return {
    isValid,
    confidence: Math.max(0, Math.min(1, confidence)),
    issues,
    recommendations,
    sessionCount,
    analysisTimestamp: new Date().toISOString()
  };
}

/**
 * Analyze traffic patterns
 */
function analyzeTrafficPatterns(visitors: any[], includeDetails: boolean): any[] {
  const patterns: any[] = [];
  const hourlyStats = new Map<string, { visitors: number; bots: number; unique: Set<string> }>();

  // Group by hour
  visitors.forEach(doc => {
    const data = doc.data();
    const timestamp = data.lastSeen?.toDate?.() || new Date(data.lastSeen);
    const hour = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours()).toISOString();

    if (!hourlyStats.has(hour)) {
      hourlyStats.set(hour, { visitors: 0, bots: 0, unique: new Set() });
    }

    const stats = hourlyStats.get(hour)!;
    stats.visitors++;
    
    if (data.isBot) {
      stats.bots++;
    }
    
    if (data.fingerprintId) {
      stats.unique.add(data.fingerprintId);
    }
  });

  // Convert to patterns array
  hourlyStats.forEach((stats, hour) => {
    const pattern = {
      timestamp: hour,
      visitorCount: stats.visitors,
      botCount: stats.bots,
      uniqueCount: stats.unique.size,
      botPercentage: stats.visitors > 0 ? (stats.bots / stats.visitors) * 100 : 0
    };

    if (includeDetails) {
      pattern.details = {
        uniqueFingerprints: Array.from(stats.unique).slice(0, 10) // Limit for performance
      };
    }

    patterns.push(pattern);
  });

  return patterns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
