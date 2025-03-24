'use client';

import { useState } from 'react';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';

/**
 * Example component demonstrating how to use the WeWrite analytics system
 * This is for demonstration purposes only and can be removed in production
 */
export default function AnalyticsExample() {
  const analytics = useWeWriteAnalytics();
  const [eventCount, setEventCount] = useState(0);

  // Example of tracking a content event
  const handleContentEvent = () => {
    analytics.trackContentEvent(analytics.events.PAGE_EDITED, {
      label: 'Example Content Edit',
      value: eventCount,
    });
    setEventCount(prev => prev + 1);
  };

  // Example of tracking an auth event
  const handleAuthEvent = () => {
    analytics.trackAuthEvent(analytics.events.USER_LOGIN, {
      label: 'Example Login',
      method: 'email',
    });
    setEventCount(prev => prev + 1);
  };

  // Example of tracking an interaction event
  const handleInteractionEvent = () => {
    analytics.trackInteractionEvent(analytics.events.SEARCH_PERFORMED, {
      label: 'Example Search',
      search_term: 'analytics example',
    });
    setEventCount(prev => prev + 1);
  };

  // Example of tracking a feature event
  const handleFeatureEvent = () => {
    analytics.trackFeatureEvent(analytics.events.THEME_CHANGED, {
      label: 'Example Theme Change',
      theme: 'dark',
    });
    setEventCount(prev => prev + 1);
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Analytics Example</CardTitle>
        <CardDescription>
          Demonstrates how to use the new WeWrite analytics system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Click the buttons below to track different types of events. 
          Open your browser console to see the events being tracked.
        </p>
        <p className="text-sm font-medium">
          Events tracked: <span className="font-bold">{eventCount}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleContentEvent} variant="outline" className="w-full">
            Track Content Event
          </Button>
          <Button onClick={handleAuthEvent} variant="outline" className="w-full">
            Track Auth Event
          </Button>
          <Button onClick={handleInteractionEvent} variant="outline" className="w-full">
            Track Interaction Event
          </Button>
          <Button onClick={handleFeatureEvent} variant="outline" className="w-full">
            Track Feature Event
          </Button>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <p>
          This component is for demonstration purposes only. 
          See <code>ANALYTICS.md</code> for full documentation.
        </p>
      </CardFooter>
    </Card>
  );
}
