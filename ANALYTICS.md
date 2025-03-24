# WeWrite Analytics Documentation

This document provides an overview of the analytics implementation in WeWrite, including how to track events and page views.

## Overview

WeWrite uses a dual-layer analytics system that tracks events in both Google Analytics and Firebase Analytics. The system is designed to:

1. Track page views with meaningful titles (important since our URLs use UUIDs)
2. Track custom events with standardized parameters
3. Provide a centralized, type-safe way to define and use event names

## Analytics Events

All analytics events are defined in `/app/constants/analytics-events.ts`. This ensures consistency in event naming across the application.

Events are organized by category:

- **Page Events**: Page views and navigation
- **Auth Events**: Login, logout, registration
- **Content Events**: Creating, editing, deleting pages and replies
- **Interaction Events**: User interactions like searches and clicks
- **Group Events**: Group-related actions
- **Feature Events**: Feature usage tracking
- **Session Events**: Session start/end tracking

## How to Track Events

### Using the React Hook (Recommended)

The easiest way to track events is using the `useWeWriteAnalytics` hook:

```jsx
import { useWeWriteAnalytics } from '../hooks/useWeWriteAnalytics';

function MyComponent() {
  const analytics = useWeWriteAnalytics();
  
  const handleButtonClick = () => {
    // Track a content event
    analytics.trackContentEvent(analytics.events.PAGE_CREATED, {
      label: 'My New Page',
      page_id: 'page-123',
    });
  };
  
  return <button onClick={handleButtonClick}>Create Page</button>;
}
```

### Using the Analytics Service Directly

For non-React contexts, you can use the analytics service directly:

```javascript
import { getAnalyticsService } from '../utils/analytics-service';
import { CONTENT_EVENTS } from '../constants/analytics-events';

function handlePageCreation(pageData) {
  const analytics = getAnalyticsService();
  
  analytics.trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
    label: pageData.title,
    page_id: pageData.id,
  });
}
```

## Page View Tracking

Page views are automatically tracked by the `GAProvider` and the `useWeWriteAnalytics` hook. The system automatically:

1. Extracts meaningful page titles based on the current route
2. Tracks the page view in both Google Analytics and Firebase Analytics
3. Includes additional metadata like page path and location

## Event Categories

When tracking events, use the appropriate category for better organization:

```javascript
import { EVENT_CATEGORIES } from '../constants/analytics-events';

analytics.trackEvent({
  category: EVENT_CATEGORIES.CONTENT,
  action: 'page_created',
  label: 'My Page Title',
});
```

## Helper Methods

The analytics service provides helper methods for each event category:

- `trackAuthEvent`: Authentication events
- `trackContentEvent`: Content-related events
- `trackInteractionEvent`: User interaction events
- `trackGroupEvent`: Group-related events
- `trackFeatureEvent`: Feature usage events
- `trackSessionEvent`: Session tracking events

## Debugging

In development mode, all analytics events are logged to the console. You can see:

- When analytics providers are initialized
- When page views are tracked
- When custom events are tracked
- Any errors that occur during tracking

## Environment Variables

The analytics system requires the following environment variables:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Google Analytics Measurement ID
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`: Firebase Analytics Measurement ID

## Best Practices

1. **Use constants for event names**: Always use the constants defined in `analytics-events.ts` instead of hardcoding event names.
2. **Include meaningful labels**: Always include a descriptive label for your events.
3. **Add page titles**: Include page titles in your events to make data analysis easier.
4. **Group related events**: Use the appropriate category for your events.
5. **Don't over-track**: Only track meaningful events that provide business value.
