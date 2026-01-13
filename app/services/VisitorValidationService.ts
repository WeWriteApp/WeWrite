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

      // NOTE: Session-level validation (suspicious patterns, interaction patterns,
      // duplicate fingerprints) has been removed as it required direct Firebase access.
      // This validation now relies on pattern-level analysis from the API.
      // For detailed session analysis, use analyzeTrafficPatterns() which fetches session data.

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
   * MIGRATED: Now uses API endpoint instead of direct Firebase queries
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
      // Use API endpoint instead of direct Firebase access
      const response = await visitorValidationApi.getTrafficPatterns(hours, true);

      if (!response.success || !response.data) {
        console.error('Failed to get traffic patterns from API:', response.error);
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

      // Transform API response to TrafficPattern format
      const patterns: TrafficPattern[] = (response.data.patterns || []).map((p: any) => ({
        timestamp: new Date(p.timestamp || p.hour),
        visitorCount: p.visitorCount || 0,
        botCount: p.botCount || 0,
        authenticatedCount: p.authenticatedCount || 0,
        pageViews: p.pageViews || 0
      }));

      // Detect anomalies
      const anomalies = this.detectAnomalies(patterns);

      // Calculate summary statistics
      const totalVisitors = patterns.reduce((sum, p) => sum + p.visitorCount, 0);
      const totalBots = patterns.reduce((sum, p) => sum + p.botCount, 0);
      const totalPageViews = patterns.reduce((sum, p) => sum + p.pageViews, 0);
      const peakVisitors = patterns.length > 0 ? Math.max(...patterns.map(p => p.visitorCount)) : 0;

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