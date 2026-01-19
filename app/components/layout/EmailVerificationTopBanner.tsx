"use client";

import React, { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from "../ui/button";
import { useEmailVerificationStatus } from '../../hooks/useEmailVerificationStatus';
import { getAnalyticsService } from "../../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';

const BANNER_HEIGHT = 40; // Height in pixels

/**
 * EmailVerificationTopBanner
 *
 * A full-width top banner that pushes all content down,
 * including the FinancialHeader. This banner is sticky at the
 * very top of the viewport on both mobile and desktop.
 *
 * The banner is always present until the user verifies their email.
 * Clicking "View details" re-opens the fullscreen email verification modal.
 */
export default function EmailVerificationTopBanner() {
  const emailVerificationStatus = useEmailVerificationStatus();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Show banner when user needs verification and has dismissed the modal
  const shouldShowBanner = emailVerificationStatus.shouldShowBanner && !emailVerificationStatus.isLoading;

  // Update CSS variable for banner height (used by floating header and main content)
  useEffect(() => {
    if (shouldShowBanner) {
      document.documentElement.style.setProperty('--email-banner-height', `${BANNER_HEIGHT}px`);
    } else {
      document.documentElement.style.setProperty('--email-banner-height', '0px');
    }

    return () => {
      document.documentElement.style.setProperty('--email-banner-height', '0px');
    };
  }, [shouldShowBanner]);

  if (!shouldShowBanner) return null;

  const handleViewDetails = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.EMAIL_VERIFICATION,
        action: ANALYTICS_EVENTS.EMAIL_BANNER_ACTION,
        label: 'View_Details'
      });
    } catch (error) {
      console.error('Error tracking email banner action:', error);
    }

    // Clear the dismissed flag to re-show the fullscreen email verification modal
    localStorage.removeItem('wewrite_email_verification_dismissed');
    window.dispatchEvent(new CustomEvent('bannerOverrideChange'));
  };

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[100]"
      style={{ height: BANNER_HEIGHT }}
      data-banner="email-verification-top"
    >
      <div className="h-full bg-primary text-primary-foreground flex items-center justify-center px-3 md:px-4">
        <div className="flex items-center gap-2 md:gap-4 max-w-4xl w-full justify-between">
          {/* Left: Icon + Message */}
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="Mail" size={16} className="flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium truncate">
              <span className="hidden sm:inline">Verify your email to show your pages on the home page</span>
              <span className="sm:hidden">Verify email to show pages</span>
            </span>
          </div>

          {/* Right: View details button */}
          <div className="flex items-center flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2 md:px-3 text-xs bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-none"
              onClick={handleViewDetails}
            >
              <span className="hidden sm:inline">View details</span>
              <span className="sm:hidden">Details</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
