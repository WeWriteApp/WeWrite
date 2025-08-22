"use client";

import React, { useState } from 'react';
import { Info, Download } from 'lucide-react';
import { Button } from "../ui/button";
import { usePWA } from '../../providers/PWAProvider';
import { useBanner } from '../../providers/BannerProvider';
import { dismissPWABanner, permanentlyDismissPWABanner, getPWAInstallInstructions } from "../../utils/pwa-detection";
import { getAnalyticsService } from "../../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "../ui/dialog";

export default function PWABanner() {
  const { setShowBanner } = usePWA();
  const { showPWABanner } = useBanner();
  const [showInstructions, setShowInstructions] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);

  // No longer need to adjust body padding since banner is not fixed

  if (!showPWABanner && !isCollapsing) return null;

  const handleDismissWithAnimation = (action: 'dont_remind' | 'maybe_later') => {
    setIsCollapsing(true);

    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: action === 'dont_remind' ? 'Dont_Remind' : 'Maybe_Later'});
    } catch (error) {
      console.error('Error tracking PWA banner action:', error);
    }

    // Start collapse animation, then dismiss after animation completes
    setTimeout(() => {
      if (action === 'dont_remind') {
        permanentlyDismissPWABanner();
      } else {
        dismissPWABanner();
      }
      setShowBanner(false);
      setIsCollapsing(false);
    }, 300); // Match animation duration
  };

  const handleDontRemind = () => handleDismissWithAnimation('dont_remind');
  const handleMaybeLater = () => handleDismissWithAnimation('maybe_later');

  const handleShowInstructions = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: 'Show_Instructions'});
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
      {/* PWA Banner - Static position at top of content */}
      <div className="relative mx-4 mb-4 md:hidden" data-banner="pwa-installation">
        <div
          className={`bg-muted/50 border border-border rounded-xl px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-sm ${
            isCollapsing ? 'max-h-0 py-0 opacity-0 transform -translate-y-4 scale-95' : 'max-h-32 opacity-100 transform translate-y-0 scale-100'
          }`}
        >
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
              Never
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs text-foreground"
              onClick={handleMaybeLater}
            >
              Later
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-9 text-xs"
              onClick={handleShowInstructions}
            >
              Yes!
            </Button>
          </div>
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