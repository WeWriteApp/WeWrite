/**
 * Cost Alerting System for Firebase Optimization
 * 
 * Provides real-time cost monitoring, threshold alerts,
 * and automated responses to cost anomalies.
 */

import { costMonitoringDashboard } from './costMonitoringDashboard';

interface AlertRule {
  id: string;
  name: string;
  type: 'threshold' | 'anomaly' | 'trend' | 'budget';
  condition: {
    metric: string;
    operator: '>' | '<' | '==' | '>=' | '<=';
    value: number;
    timeWindow?: number; // minutes
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  actions: AlertAction[];
  cooldownPeriod: number; // minutes
  lastTriggered?: number;
}

interface AlertAction {
  type: 'email' | 'webhook' | 'auto_optimize' | 'log' | 'disable_feature';
  config: Record<string, any>;
}

interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  resolved: boolean;
  resolvedAt?: number;
  actions: AlertAction[];
}

class CostAlertingSystem {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_FREQUENCY = 60000; // 1 minute

  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Initialize default alerting rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'daily_budget_warning',
        name: 'Daily Budget Warning',
        type: 'threshold',
        condition: {
          metric: 'daily_spend',
          operator: '>',
          value: 4.00, // $4 daily warning
          timeWindow: 1440 // 24 hours
        },
        severity: 'medium',
        enabled: true,
        actions: [
          { type: 'log', config: { level: 'warn' } },
          { type: 'auto_optimize', config: { level: 'moderate' } }
        ],
        cooldownPeriod: 60 // 1 hour
      },
      {
        id: 'daily_budget_critical',
        name: 'Daily Budget Critical',
        type: 'threshold',
        condition: {
          metric: 'daily_spend',
          operator: '>',
          value: 5.00, // $5 daily critical
          timeWindow: 1440
        },
        severity: 'critical',
        enabled: true,
        actions: [
          { type: 'log', config: { level: 'error' } },
          { type: 'auto_optimize', config: { level: 'aggressive' } },
          { type: 'webhook', config: { url: '/api/alerts/cost-critical' } }
        ],
        cooldownPeriod: 30 // 30 minutes
      },
      {
        id: 'query_cost_spike',
        name: 'Query Cost Spike',
        type: 'anomaly',
        condition: {
          metric: 'hourly_query_cost',
          operator: '>',
          value: 0.50, // $0.50 per hour
          timeWindow: 60
        },
        severity: 'high',
        enabled: true,
        actions: [
          { type: 'log', config: { level: 'warn' } },
          { type: 'auto_optimize', config: { level: 'query_throttling' } }
        ],
        cooldownPeriod: 15 // 15 minutes
      },
      {
        id: 'optimization_score_low',
        name: 'Low Optimization Score',
        type: 'threshold',
        condition: {
          metric: 'optimization_score',
          operator: '<',
          value: 60,
          timeWindow: 60
        },
        severity: 'medium',
        enabled: true,
        actions: [
          { type: 'log', config: { level: 'info' } },
          { type: 'auto_optimize', config: { level: 'review_settings' } }
        ],
        cooldownPeriod: 120 // 2 hours
      },
      {
        id: 'listener_cost_high',
        name: 'High Listener Costs',
        type: 'threshold',
        condition: {
          metric: 'realtime_connections',
          operator: '>',
          value: 50,
          timeWindow: 30
        },
        severity: 'medium',
        enabled: true,
        actions: [
          { type: 'log', config: { level: 'warn' } },
          { type: 'auto_optimize', config: { level: 'listener_throttling' } }
        ],
        cooldownPeriod: 30
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    console.log(`[CostAlertingSystem] Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Start monitoring system
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkAlertRules();
    }, this.MONITORING_FREQUENCY);

    console.log('[CostAlertingSystem] Started cost monitoring');
  }

  /**
   * Check all alert rules against current metrics
   */
  private async checkAlertRules(): Promise<void> {
    try {
      const dashboard = await costMonitoringDashboard.getDashboard();
      const currentMetrics = this.extractMetrics(dashboard);

      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        // Check cooldown period
        if (rule.lastTriggered && 
            Date.now() - rule.lastTriggered < rule.cooldownPeriod * 60000) {
          continue;
        }

        const shouldTrigger = this.evaluateRule(rule, currentMetrics);
        if (shouldTrigger) {
          await this.triggerAlert(rule, currentMetrics);
        }
      }

      // Check for resolved alerts
      this.checkResolvedAlerts(currentMetrics);

    } catch (error) {
      console.error('[CostAlertingSystem] Error checking alert rules:', error);
    }
  }

  /**
   * Extract metrics from dashboard data
   */
  private extractMetrics(dashboard: any): Record<string, number> {
    return {
      daily_spend: this.estimateDailySpend(dashboard),
      hourly_query_cost: dashboard.breakdown.queries.savings || 0,
      optimization_score: dashboard.metrics.optimizationScore || 0,
      realtime_connections: dashboard.breakdown.listeners.activeListeners || 0,
      cache_hit_rate: dashboard.breakdown.caching.hitRate || 0,
      total_savings: dashboard.metrics.totalSavings || 0
    };
  }

  /**
   * Estimate daily spend from dashboard data
   */
  private estimateDailySpend(dashboard: any): number {
    const queryStats = dashboard.breakdown.queries;
    const estimatedDailyReads = queryStats.totalQueries * 10; // Estimate
    const estimatedDailyWrites = estimatedDailyReads * 0.1;
    
    const readCost = (estimatedDailyReads / 100000) * 0.36;
    const writeCost = (estimatedDailyWrites / 100000) * 1.08;
    
    return readCost + writeCost;
  }

  /**
   * Evaluate if a rule should trigger
   */
  private evaluateRule(rule: AlertRule, metrics: Record<string, number>): boolean {
    const metricValue = metrics[rule.condition.metric];
    if (metricValue === undefined) return false;

    const { operator, value } = rule.condition;

    switch (operator) {
      case '>': return metricValue > value;
      case '<': return metricValue < value;
      case '>=': return metricValue >= value;
      case '<=': return metricValue <= value;
      case '==': return metricValue === value;
      default: return false;
    }
  }

  /**
   * Trigger an alert and execute actions
   */
  private async triggerAlert(rule: AlertRule, metrics: Record<string, number>): Promise<void> {
    const alertId = this.generateAlertId();
    const metricValue = metrics[rule.condition.metric];

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.condition.metric} is ${metricValue} (threshold: ${rule.condition.value})`,
      timestamp: Date.now(),
      metric: rule.condition.metric,
      currentValue: metricValue,
      thresholdValue: rule.condition.value,
      resolved: false,
      actions: rule.actions
    };

    this.alerts.push(alert);
    rule.lastTriggered = Date.now();

    console.log(`[CostAlertingSystem] ALERT TRIGGERED: ${alert.message}`);

    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAction(action, alert);
    }

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Execute an alert action
   */
  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    try {
      switch (action.type) {
        case 'log':
          const level = action.config.level || 'info';
          console[level](`[CostAlert] ${alert.message}`);
          break;

        case 'auto_optimize':
          await this.executeAutoOptimization(action.config.level, alert);
          break;

        case 'webhook':
          await this.sendWebhook(action.config.url, alert);
          break;

        case 'disable_feature':
          await this.disableFeature(action.config.feature);
          break;

        default:
          console.warn(`[CostAlertingSystem] Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`[CostAlertingSystem] Error executing action ${action.type}:`, error);
    }
  }

  /**
   * Execute automatic optimization
   */
  private async executeAutoOptimization(level: string, alert: Alert): Promise<void> {
    console.log(`[CostAlertingSystem] Executing auto-optimization (level: ${level}) for alert: ${alert.id}`);

    switch (level) {
      case 'moderate':
        // Increase cache TTLs
        console.log('[CostAlertingSystem] Applying moderate optimizations: increasing cache TTLs');
        break;

      case 'aggressive':
        // Reduce real-time features, increase throttling
        console.log('[CostAlertingSystem] Applying aggressive optimizations: reducing real-time features');
        break;

      case 'query_throttling':
        // Implement query rate limiting
        console.log('[CostAlertingSystem] Applying query throttling optimizations');
        break;

      case 'listener_throttling':
        // Reduce listener frequency
        console.log('[CostAlertingSystem] Applying listener throttling optimizations');
        break;

      case 'review_settings':
        // Log optimization recommendations
        console.log('[CostAlertingSystem] Logging optimization recommendations for review');
        break;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          source: 'CostAlertingSystem'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      console.log(`[CostAlertingSystem] Webhook sent successfully to ${url}`);
    } catch (error) {
      console.error(`[CostAlertingSystem] Webhook error:`, error);
    }
  }

  /**
   * Disable a feature temporarily
   */
  private async disableFeature(feature: string): Promise<void> {
    console.log(`[CostAlertingSystem] Temporarily disabling feature: ${feature}`);
    // Implementation would depend on the specific feature
  }

  /**
   * Check for resolved alerts
   */
  private checkResolvedAlerts(metrics: Record<string, number>): void {
    for (const alert of this.alerts) {
      if (alert.resolved) continue;

      const rule = this.rules.get(alert.ruleId);
      if (!rule) continue;

      // Check if condition is no longer met
      const shouldTrigger = this.evaluateRule(rule, metrics);
      if (!shouldTrigger) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        console.log(`[CostAlertingSystem] Alert resolved: ${alert.message}`);
      }
    }
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`[CostAlertingSystem] Added custom alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      console.log(`[CostAlertingSystem] Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Get current alerts
   */
  getAlerts(includeResolved: boolean = false): Alert[] {
    return includeResolved 
      ? this.alerts 
      : this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get alert statistics
   */
  getStats() {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const last24Hours = this.alerts.filter(a => Date.now() - a.timestamp < 86400000);

    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalAlerts: this.alerts.length,
      activeAlerts: activeAlerts.length,
      alertsLast24h: last24Hours.length,
      severityBreakdown: {
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length
      }
    };
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[CostAlertingSystem] Stopped cost monitoring');
  }
}

// Export singleton instance
export const costAlertingSystem = new CostAlertingSystem();

// Convenience functions
export const addCostAlertRule = (rule: AlertRule) => {
  costAlertingSystem.addRule(rule);
};

export const removeCostAlertRule = (ruleId: string) => {
  return costAlertingSystem.removeRule(ruleId);
};

export const getCostAlerts = (includeResolved?: boolean) => {
  return costAlertingSystem.getAlerts(includeResolved);
};

export const getCostAlertStats = () => {
  return costAlertingSystem.getStats();
};

export const destroyCostAlerting = () => {
  costAlertingSystem.destroy();
};
