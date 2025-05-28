"use client";

import React, { useState } from 'react';
import { X, Info, Download } from 'lucide-react';
import { Button } from "../ui/button";
import { usePWA } from '../providers/PWAProvider';
import { dismissPWABanner, permanentlyDismissPWABanner, getPWAInstallInstructions } from "../utils/pwa-detection";
import { getAnalyticsService } from "../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export default function PWABanner() {
  const { showBanner, setShowBanner } = usePWA();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!showBanner) return null;

  const handleDontRemind = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: 'Dont_Remind',
      });
    } catch (error) {
      console.error('Error tracking PWA banner action:', error);
    }

    permanentlyDismissPWABanner();
    setShowBanner(false);
  };

  const handleMaybeLater = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: 'Maybe_Later',
      });
    } catch (error) {
      console.error('Error tracking PWA banner action:', error);
    }

    dismissPWABanner();
    setShowBanner(false);
  };

  const handleShowInstructions = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: 'Show_Instructions',
      });
    } catch (error) {
      console.error('Error tracking PWA banner action:', error);
    }

    setShowInstructions(true);
  };

  const handleCloseInstructions = () => {
    setShowInstructions(false);
    dismissPWABanner();
    setShowBanner(false);
  };

  return (
    <>
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex flex-col">
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Want to use WeWrite as an app?</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs text-foreground"
            onClick={handleDontRemind}
          >
            Don't remind me
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs text-foreground"
            onClick={handleMaybeLater}
          >
            Maybe later
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-9 text-xs"
            onClick={handleShowInstructions}
          >
            Show me how
          </Button>
        </div>
      </div>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install WeWrite as an app</DialogTitle>
            <DialogDescription>
              Follow these instructions to install WeWrite on your device:
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted/50 rounded-md my-4">
            <p className="text-sm">{getPWAInstallInstructions()}</p>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Download className="h-5 w-5 text-primary" />
            <p className="text-sm">
              Installing as an app gives you a better experience with faster loading times and offline access.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" className="text-foreground" onClick={handleCloseInstructions}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
