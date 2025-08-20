/**
 * Visitor validation and monitoring service for ensuring data integrity
 * Provides real-time validation against known traffic patterns and suspicious activity
 */

// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { visitorValidationApi } from '../utils/apiClient';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  recommendations: string[];
}

interface TrafficPattern {
  timestamp: Date;
  visitorCount: number;
  botCount: number;
  authenticatedCount: number;
  pageViews: number;
}

interface SuspiciousActivity {
  type: 'rapid_requests' | 'unusual_patterns' | 'bot_surge' | 'session_anomaly';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class VisitorValidationService {
  private static readonly VALIDATION_THRESHOLDS = {
    MAX_VISITORS_PER_MINUTE: 100,
    MAX_BOT_PERCENTAGE: 0.3, // 30%
    MIN_SESSION_DURATION: 5, // seconds
    MAX_PAGE_VIEWS_PER_SESSION: 50,
    SUSPICIOUS_USER_AGENT_LENGTH: 500
  };

  /**
   * Validate current visitor metrics against expected patterns
   * MIGRATED: Now uses API endpoint instead of direct Firebase queries
   */
  static async validateCurrentMetrics(): Promise<ValidationResult> {
    try {
      console.log('🔍 [VISITOR VALIDATION] Validating current metrics via API');

      // Get traffic patterns from API
      const response = await visitorValidationApi.getTrafficPatterns(1, true); // Last 1 hour with details

      if (!response.success) {
        console.error('🔍 [VISITOR VALIDATION] Failed to get traffic patterns:', response.error);
        return {
          isValid: false,
          confidence: 0.1,
          issues: ['Failed to fetch traffic data'],
          recommendations: ['Check API connectivity']
        };
      }

      const { patterns, totalVisitors } = response.data;
      const issues: string[] = [];
      const recommendations: string[] = [];
      let confidence = 1.0;

      // 1. Check for unusual visitor volume
      if (totalVisitors > this.VALIDATION_THRESHOLDS.MAX_VISITORS_PER_MINUTE) {
        issues.push(`Unusually high visitor count: ${totalVisitors}`);
        recommendations.push('Monitor for potential DDoS or bot attack');
        confidence -= 0.3;
      }

      // 2. Validate bot detection accuracy
      const recentPattern = patterns[patterns.length - 1]; // Most recent hour
      if (recentPattern && recentPattern.botPercentage > this.VALIDATION_THRESHOLDS.MAX_BOT_PERCENTAGE * 100) {
        issues.push(`High bot percentage: ${recentPattern.botPercentage.toFixed(1)}%`);
        recommendations.push('Review bot detection rules and consider stricter filtering');
        confidence -= 0.2;
      }

      // 3. Check for traffic spikes
      if (patterns.length > 1) {
        const avgVisitors = patterns.reduce((sum, p) => sum + p.visitorCount, 0) / patterns.length;
        const maxVisitors = Math.max(...patterns.map(p => p.visitorCount));

        if (maxVisitors > avgVisitors * 3) {
          issues.push(`Traffic spike detected: ${maxVisitors} vs avg ${avgVisitors.toFixed(0)}`);
          recommendations.push('Monitor for unusual activity patterns');
          confidence -= 0.15;
        }
      }

      // Check for suspicious session patterns
      const suspiciousSessions = sessions.filter(s =>
        s.pageViews > this.VALIDATION_THRESHOLDS.MAX_PAGE_VIEWS_PER_SESSION ||
        s.sessionDuration < this.VALIDATION_THRESHOLDS.MIN_SESSION_DURATION ||
        (s.userAgent && s.userAgent.length > this.VALIDATION_THRESHOLDS.SUSPICIOUS_USER_AGENT_LENGTH)
      );

      if (suspiciousSessions.length > 0) {
        issues.push(`${suspiciousSessions.length} sessions with suspicious patterns`);
        recommendations.push('Investigate sessions with unusual behavior patterns');
        confidence -= 0.1;
      }

      // 4. Validate interaction patterns
      const zeroInteractionSessions = sessions.filter(s => 
        s.sessionDuration > 30 && 
        s.interactions && 
        Object.values(s.interactions).every(count => count === 0)
      );

      if (zeroInteractionSessions.length > sessions.length * 0.2) {
        issues.push(`${zeroInteractionSessions.length} sessions with no user interactions`);
        recommendations.push('Review interaction tracking implementation');
        confidence -= 0.15;
      }

      // 5. Check for duplicate fingerprints (potential session duplication)
      const fingerprints = new Map();
      sessions.forEach(s => {
        if (s.fingerprint && s.fingerprint.id) {
          const existing = fingerprints.get(s.fingerprint.id) || 0;
          fingerprints.set(s.fingerprint.id, existing + 1);
        }
      });

      const duplicateFingerprints = Array.from(fingerprints.entries()).filter(([_, count]) => count > 1);
      if (duplicateFingerprints.length > 0) {
        issues.push(`${duplicateFingerprints.length} duplicate fingerprints detected`);
        recommendations.push('Check session deduplication logic');
        confidence -= 0.1;
      }

      return {
        isValid: confidence > 0.7,
        confidence: Math.max(0, confidence),
        issues,
        recommendations
      };

    } catch (error) {
      console.error('Error validating visitor metrics:', error);
      return {
        isValid: false,
        confidence: 0,
        issues: ['Failed to validate metrics due to system error'],
        recommendations: ['Check system connectivity and permissions']
      };
    }
  }

  /**
   * Analyze traffic patterns over time for anomaly detection
   */
  static async analyzeTrafficPatterns(hours: number = 24): Promise<{
    patterns: TrafficPattern[];
    anomalies: SuspiciousActivity[];
    summary: {
      avgVisitorsPerHour: number;
      peakVisitors: number;
      avgBotPercentage: number;
      totalPageViews: number;
    };
  }> {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
      const visitorsRef = collection(db, getCollectionName('siteVisitors'));
      const q = query(
        visitorsRef,
        where('startTime', '>=', Timestamp.fromDate(hoursAgo)),
        orderBy('startTime', 'desc'),
        limit(1000)
      );

      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Group sessions by hour
      const hourlyData = new Map<string, TrafficPattern>();
      
      sessions.forEach(session => {
        const hour = new Date(session.startTime.toDate()).toISOString().slice(0, 13) + ':00:00';
        
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, {
            timestamp: new Date(hour),
            visitorCount: 0,
            botCount: 0,
            authenticatedCount: 0,
            pageViews: 0
          });
        }

        const pattern = hourlyData.get(hour)!;
        pattern.visitorCount++;
        pattern.pageViews += session.pageViews || 0;
        
        if (session.isBot) {
          pattern.botCount++;
        }
        
        if (session.isAuthenticated) {
          pattern.authenticatedCount++;
        }
      });

      const patterns = Array.from(hourlyData.values()).sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Detect anomalies
      const anomalies = this.detectAnomalies(patterns);

      // Calculate summary statistics
      const totalVisitors = patterns.reduce((sum, p) => sum + p.visitorCount, 0);
      const totalBots = patterns.reduce((sum, p) => sum + p.botCount, 0);
      const totalPageViews = patterns.reduce((sum, p) => sum + p.pageViews, 0);
      const peakVisitors = Math.max(...patterns.map(p => p.visitorCount));

      return {
        patterns,
        anomalies,
        summary: {
          avgVisitorsPerHour: patterns.length > 0 ? totalVisitors / patterns.length : 0,
          peakVisitors,
          avgBotPercentage: totalVisitors > 0 ? (totalBots / totalVisitors) * 100 : 0,
          totalPageViews
        }
      };

    } catch (error) {
      console.error('Error analyzing traffic patterns:', error);
      return {
        patterns: [],
        anomalies: [],
        summary: {
          avgVisitorsPerHour: 0,
          peakVisitors: 0,
          avgBotPercentage: 0,
          totalPageViews: 0
        }
      };
    }
  }

  /**
   * Detect anomalies in traffic patterns
   */
  private static detectAnomalies(patterns: TrafficPattern[]): SuspiciousActivity[] {
    const anomalies: SuspiciousActivity[] = [];

    if (patterns.length < 3) return anomalies;

    // Calculate baseline metrics
    const avgVisitors = patterns.reduce((sum, p) => sum + p.visitorCount, 0) / patterns.length;
    const avgBots = patterns.reduce((sum, p) => sum + p.botCount, 0) / patterns.length;

    patterns.forEach((pattern, index) => {
      // Detect traffic spikes
      if (pattern.visitorCount > avgVisitors * 3) {
        anomalies.push({
          type: 'rapid_requests',
          severity: 'high',
          description: `Traffic spike: ${pattern.visitorCount} visitors (${(pattern.visitorCount / avgVisitors).toFixed(1)}x normal)`,
          timestamp: pattern.timestamp,
          metadata: { visitorCount: pattern.visitorCount, baseline: avgVisitors }
        });
      }

      // Detect bot surges
      if (pattern.botCount > avgBots * 5 && pattern.botCount > 10) {
        anomalies.push({
          type: 'bot_surge',
          severity: 'medium',
          description: `Bot surge: ${pattern.botCount} bots detected`,
          timestamp: pattern.timestamp,
          metadata: { botCount: pattern.botCount, baseline: avgBots }
        });
      }

      // Detect unusual patterns (very low interaction with high page views)
      const avgPageViewsPerVisitor = pattern.visitorCount > 0 ? pattern.pageViews / pattern.visitorCount : 0;
      if (avgPageViewsPerVisitor > 20) {
        anomalies.push({
          type: 'unusual_patterns',
          severity: 'medium',
          description: `High page views per visitor: ${avgPageViewsPerVisitor.toFixed(1)} pages/visitor`,
          timestamp: pattern.timestamp,
          metadata: { pageViewsPerVisitor: avgPageViewsPerVisitor }
        });
      }
    });

    return anomalies;
  }

  /**
   * Generate a comprehensive validation report
   */
  static async generateValidationReport(): Promise<{
    timestamp: Date;
    currentMetrics: ValidationResult;
    trafficAnalysis: Awaited<ReturnType<typeof VisitorValidationService.analyzeTrafficPatterns>>;
    recommendations: string[];
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  }> {
    const currentMetrics = await this.validateCurrentMetrics();
    const trafficAnalysis = await this.analyzeTrafficPatterns(24);

    const allRecommendations = [
      ...currentMetrics.recommendations,
      ...trafficAnalysis.anomalies.map(a => `Address ${a.type}: ${a.description}`)
    ];

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
    
    if (!currentMetrics.isValid || trafficAnalysis.anomalies.some(a => a.severity === 'high')) {
      overallHealth = 'critical';
    } else if (currentMetrics.confidence < 0.8 || trafficAnalysis.anomalies.some(a => a.severity === 'medium')) {
      overallHealth = 'warning';
    } else if (currentMetrics.confidence < 0.9 || trafficAnalysis.anomalies.length > 0) {
      overallHealth = 'good';
    }

    return {
      timestamp: new Date(),
      currentMetrics,
      trafficAnalysis,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      overallHealth
    };
  }
}