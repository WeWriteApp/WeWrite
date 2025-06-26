# Automated Payout Processing System

## Overview

The Automated Payout Processing System provides comprehensive automation for processing writer payouts in WeWrite, including scheduling, monitoring, error handling, and retry logic. The system ensures reliable and efficient payout processing while maintaining data integrity and providing detailed monitoring capabilities.

## Architecture

### Core Components

1. **AutomatedPayoutService** - Handles batch processing of payouts with concurrency control
2. **PayoutSchedulerService** - Manages scheduling and triggering of automated payout runs
3. **PayoutMonitoringService** - Monitors system health, tracks metrics, and generates alerts
4. **Cron Endpoints** - Provides scheduled execution via external cron services

### Key Features

- **Batch Processing**: Processes payouts in configurable batches with concurrency limits
- **Retry Logic**: Automatic retry with exponential backoff for failed payouts
- **Error Handling**: Comprehensive error tracking and recovery mechanisms
- **Monitoring**: Real-time health monitoring with alerting capabilities
- **Scheduling**: Flexible scheduling with daily, weekly, or monthly frequencies
- **Transaction Tracking**: End-to-end correlation tracking for all operations

## Configuration

### Automated Payout Configuration

```typescript
interface AutomatedPayoutConfig {
  batchSize: number;              // Default: 10
  maxRetries: number;             // Default: 3
  retryDelayMs: number;           // Default: 30000 (30 seconds)
  processingTimeoutMs: number;    // Default: 300000 (5 minutes)
  minimumThreshold: number;       // Default: 25 (USD)
  maxConcurrentProcessing: number; // Default: 5
  enableFailsafe: boolean;        // Default: true
}
```

### Schedule Configuration

```typescript
interface PayoutScheduleConfig {
  enabled: boolean;               // Default: true
  frequency: 'daily' | 'weekly' | 'monthly'; // Default: 'monthly'
  dayOfWeek?: number;            // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number;           // 1-31 for monthly
  hour: number;                  // Default: 9 (9 AM)
  minute: number;                // Default: 0
  timezone: string;              // Default: 'UTC'
  minimumThreshold: number;      // Default: 25
  batchSize: number;             // Default: 10
  maxRetries: number;            // Default: 3
  notificationEmails: string[];  // Default: []
}
```

### Alert Configuration

```typescript
interface PayoutAlertConfig {
  enabled: boolean;                    // Default: true
  failureRateThreshold: number;        // Default: 10 (%)
  pendingPayoutThreshold: number;      // Default: 50
  processingDelayThreshold: number;    // Default: 24 (hours)
  totalAmountThreshold: number;        // Default: 10000 (USD)
  notificationEmails: string[];        // Default: []
  webhookUrls: string[];              // Default: []
}
```

## API Endpoints

### Cron Endpoint

**POST** `/api/cron/automated-payouts`

Triggers automated payout processing. Intended for use by external cron services.

**Headers:**
- `Authorization: Bearer <CRON_API_KEY>`

**Body:**
```json
{
  "forceRun": false,     // Override schedule check
  "dryRun": false,       // Simulate without processing
  "batchSize": 10,       // Override default batch size
  "maxRetries": 3        // Override default retry count
}
```

**Response:**
```json
{
  "success": true,
  "status": "success",
  "message": "Automated payout processing completed",
  "data": {
    "runId": "scheduled_run_1234567890",
    "totalPayouts": 25,
    "successfulPayouts": 23,
    "failedPayouts": 2,
    "totalAmount": 2500.00,
    "duration": 45000,
    "errors": [...],
    "nextScheduledTime": "2024-02-01T09:00:00.000Z"
  },
  "correlationId": "corr_abc123"
}
```

### Monitoring Dashboard

**GET** `/api/admin/payout-monitoring`

Retrieves comprehensive monitoring data for the payout system.

**Query Parameters:**
- `includeHistory=true` - Include recent run history
- `includeAlerts=true` - Include active alerts
- `includeMetrics=true` - Include health metrics
- `historyLimit=20` - Limit for history records

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "scheduler": {
      "isRunning": false,
      "nextScheduledTime": "2024-02-01T09:00:00.000Z",
      "config": {...}
    },
    "processing": {
      "isProcessing": false,
      "totalInQueue": 0,
      "totalCompleted": 150,
      "totalFailed": 5
    },
    "health": {
      "status": "healthy",
      "metrics": {...},
      "activeAlerts": [],
      "systemLoad": {...}
    }
  }
}
```

**POST** `/api/admin/payout-monitoring`

Performs administrative actions on the payout system.

**Actions:**
- `triggerPayouts` - Manually trigger payout processing
- `updateSchedule` - Update schedule configuration
- `updateAlertConfig` - Update alert configuration
- `acknowledgeAlert` - Acknowledge an alert
- `resolveAlert` - Resolve an alert
- `getMetrics` - Calculate current metrics

## Usage Examples

### Basic Setup

```typescript
import { AutomatedPayoutService } from './services/automatedPayoutService';
import { PayoutSchedulerService } from './services/payoutSchedulerService';
import { PayoutMonitoringService } from './services/payoutMonitoringService';

// Initialize services
const payoutService = AutomatedPayoutService.getInstance({
  batchSize: 20,
  maxRetries: 5,
  minimumThreshold: 25
});

const scheduler = PayoutSchedulerService.getInstance();
await scheduler.initialize();

const monitoring = PayoutMonitoringService.getInstance();
await monitoring.initialize();
```

### Manual Payout Processing

```typescript
// Process all pending payouts
const result = await payoutService.processAllPendingPayouts();

if (result.success) {
  console.log(`Processed ${result.data.totalProcessed} payouts`);
  console.log(`Successful: ${result.data.successful}`);
  console.log(`Failed: ${result.data.failed}`);
} else {
  console.error('Payout processing failed:', result.error?.message);
}
```

### Schedule Management

```typescript
// Update schedule configuration
await scheduler.updateScheduleConfig({
  frequency: 'weekly',
  dayOfWeek: 1, // Monday
  hour: 10,
  minute: 0,
  enabled: true
});

// Check if scheduled run should execute
if (scheduler.shouldRunScheduledPayouts()) {
  const result = await scheduler.runScheduledPayouts();
  console.log('Scheduled run completed:', result.data);
}
```

### Monitoring and Alerts

```typescript
// Get current health status
const health = await monitoring.getHealthStatus();
console.log('System status:', health.data.status);
console.log('Active alerts:', health.data.activeAlerts.length);

// Calculate current metrics
const metrics = await monitoring.calculateMetrics();
console.log('Success rate:', metrics.data.successRate);
console.log('Failure rate:', metrics.data.failureRate);

// Handle alerts
for (const alert of health.data.activeAlerts) {
  if (alert.severity === 'critical') {
    await monitoring.acknowledgeAlert(alert.id);
    // Handle critical alert...
  }
}
```

## Monitoring and Alerting

### Health Status Levels

- **Healthy**: All systems operating normally, low failure rates
- **Warning**: Some issues detected, elevated failure rates or delays
- **Critical**: Significant problems, high failure rates or system errors

### Alert Types

1. **failure_rate** - Payout failure rate exceeds threshold
2. **pending_threshold** - Too many pending payouts
3. **processing_delay** - Average processing time too high
4. **amount_threshold** - Total payout amount exceeds threshold
5. **system_error** - System-level errors or failures

### Metrics Tracked

- Total payouts processed
- Success/failure rates
- Average processing time
- Pending payout counts
- Total amounts processed
- Retry rates
- System load indicators

## Error Handling

### Retry Logic

1. **Automatic Retries**: Failed payouts are automatically retried up to `maxRetries`
2. **Exponential Backoff**: Retry delays increase with each attempt
3. **Failure Classification**: Distinguishes between retryable and permanent failures
4. **Circuit Breaking**: Prevents cascade failures during system issues

### Error Recovery

1. **Transaction Rollback**: Failed operations are properly rolled back
2. **State Consistency**: Database state remains consistent during failures
3. **Correlation Tracking**: All operations are tracked with correlation IDs
4. **Audit Logging**: Comprehensive logging for debugging and compliance

## Security Considerations

1. **API Key Protection**: Cron endpoints protected with secure API keys
2. **Admin Access Control**: Monitoring endpoints require admin authentication
3. **Data Encryption**: Sensitive data encrypted in transit and at rest
4. **Audit Trails**: All operations logged with user and correlation tracking
5. **Rate Limiting**: Processing limits prevent system overload

## Deployment

### Environment Variables

```bash
# Required
CRON_API_KEY=your_secure_cron_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# Optional
PAYOUT_BATCH_SIZE=10
PAYOUT_MAX_RETRIES=3
PAYOUT_MIN_THRESHOLD=25
MONITORING_ENABLED=true
```

### Cron Job Setup

```bash
# Monthly processing on 1st at 9 AM UTC
0 9 1 * * curl -X POST \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forceRun": false}' \
  https://your-app.com/api/cron/automated-payouts
```

## Testing

Run the comprehensive test suite:

```bash
npm test app/tests/automatedPayoutSystem.test.ts
```

The test suite covers:
- Batch processing logic
- Retry mechanisms
- Error handling
- Scheduling functionality
- Monitoring and alerting
- Integration scenarios

## Troubleshooting

### Common Issues

1. **High Failure Rates**: Check Stripe account status and connectivity
2. **Processing Delays**: Review batch size and concurrency settings
3. **Alert Fatigue**: Adjust alert thresholds based on normal operation
4. **Memory Issues**: Reduce batch size for large payout volumes

### Debug Information

All operations include correlation IDs for tracking. Use these IDs to trace operations across logs and database records.

### Support

For issues with the automated payout system, check:
1. System health status via monitoring endpoint
2. Recent error logs with correlation IDs
3. Stripe dashboard for external service issues
4. Database consistency via reconciliation reports
