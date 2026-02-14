"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
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

const BANNER_HEIGHT = 48; // Height in pixels - slightly taller than email banner for prominence

/**
 * PWABanner
 *
 * A full-width top banner that matches the EmailVerificationTopBanner style.
 * Fixed at the top of the viewport on mobile only.
 * Uses the same CSS variable pattern for layout coordination.
 */
export default function PWABanner() {
  const { setShowBanner } = usePWA();
  const { showPWABanner } = useBanner();
  const [showInstructions, setShowInstructions] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Update CSS variable for banner height (used by floating header and main content)
  useEffect(() => {
    if (showPWABanner) {
      document.documentElement.style.setProperty('--pwa-banner-height', `${BANNER_HEIGHT}px`);
    } else {
      document.documentElement.style.setProperty('--pwa-banner-height', '0px');
    }

    return () => {
      document.documentElement.style.setProperty('--pwa-banner-height', '0px');
    };
  }, [showPWABanner]);

  if (!showPWABanner) return null;

  const handleDismiss = (action: 'dont_remind' | 'maybe_later') => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: action === 'dont_remind' ? 'Dont_Remind' : 'Maybe_Later'
      });
    } catch (error) {
      console.error('Error tracking PWA banner action:', error);
    }

    if (action === 'dont_remind') {
      permanentlyDismissPWABanner();
    } else {
      dismissPWABanner();
    }
    setShowBanner(false);
  };

  const handleShowInstructions = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.PWA,
        action: ANALYTICS_EVENTS.PWA_BANNER_ACTION,
        label: 'Show_Instructions'
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
      {/* PWA Banner - Fixed position at top, matching email verification banner style */}
      <div
        ref={bannerRef}
        className="fixed top-0 left-0 right-0 z-[100] lg:hidden"
        style={{ height: BANNER_HEIGHT }}
        data-banner="pwa-installation"
      >
        <div className="h-full bg-primary text-primary-foreground flex items-center justify-center px-4">
          <div className="flex items-center gap-3 max-w-4xl w-full justify-between">
            {/* Left: Icon + Message */}
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="Download" size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                Install WeWrite as an app
              </span>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-sm bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-none"
                onClick={() => handleDismiss('maybe_later')}
              >
                Later
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-sm bg-primary-foreground hover:bg-primary-foreground/90 text-primary border-none"
                onClick={handleShowInstructions}
              >
                Install
              </Button>
            </div>
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
            <Icon name="Download" size={20} className="text-primary" />
            <p className="text-sm">
              Installing as an app gives you a better experience with faster loading times and offline access.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="secondary" className="text-foreground" onClick={handleCloseInstructions}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}