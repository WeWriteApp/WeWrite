"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Smartphone, RefreshCw } from 'lucide-react';
import { usePWA } from '../providers/PWAProvider';
import { getAnalyticsService } from '../utils/analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

interface AdminSettingsProps {
  userEmail: string;
}

export default function AdminSettings({ userEmail }: AdminSettingsProps) {
  const { resetBannerState } = usePWA();

  // Only show admin settings for specific user
  if (userEmail !== 'jameigray2234@gmail.com') {
    return null;
  }

  const handleTriggerPWAAlert = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.ADMIN,
        action: ANALYTICS_EVENTS.PWA_BANNER_RESET,
        label: userEmail,
      });
    } catch (error) {
      console.error('Error tracking admin action:', error);
    }

    resetBannerState();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Admin Settings
        </CardTitle>
        <CardDescription>
          Special settings for administrators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">PWA Testing</h3>
          <p className="text-sm text-muted-foreground">
            Test the PWA installation banner by forcing it to appear.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-2"
            onClick={handleTriggerPWAAlert}
          >
            <RefreshCw className="h-4 w-4" />
            Trigger PWA Alert
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
