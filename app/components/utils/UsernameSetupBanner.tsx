"use client";

import React, { useState } from 'react';
import { User, ArrowRight } from 'lucide-react';
import { Button } from "../ui/button";
import { useBanner } from '../../providers/BannerProvider';
import { useRouter } from 'next/navigation';
import { getAnalyticsService } from "../../utils/analytics-service";

const STORAGE_KEYS = {
  USERNAME_BANNER_DISMISSED_TIMESTAMP: 'wewrite_username_banner_dismissed_timestamp',
  USERNAME_DONT_REMIND: 'wewrite_username_dont_remind'
};

export default function UsernameSetupBanner() {
  const { showUsernameBanner, setUsernameBannerDismissed } = useBanner();
  const [isCollapsing, setIsCollapsing] = useState(false);
  const router = useRouter();

  if (!showUsernameBanner && !isCollapsing) return null;

  const handleDismissWithAnimation = (action: 'dont_remind' | 'later') => {
    setIsCollapsing(true);

    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: 'user_profile',
        action: 'username_banner_action',
        label: action === 'dont_remind' ? 'Dont_Remind' : 'Later'
      });
    } catch (error) {
      console.error('Error tracking username banner action:', error);
    }

    // Start collapse animation, then dismiss after animation completes
    setTimeout(() => {
      if (action === 'dont_remind') {
        localStorage.setItem(STORAGE_KEYS.USERNAME_DONT_REMIND, 'true');
      } else {
        localStorage.setItem(STORAGE_KEYS.USERNAME_BANNER_DISMISSED_TIMESTAMP, Date.now().toString());
      }
      setUsernameBannerDismissed();
      setIsCollapsing(false);
    }, 300); // Match animation duration
  };

  const handleLater = () => handleDismissWithAnimation('later');

  const handleSetUsername = () => {
    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: 'user_profile',
        action: 'username_banner_action',
        label: 'Set_Username_Clicked'
      });
    } catch (error) {
      console.error('Error tracking set username click:', error);
    }

    router.push('/settings/profile');
  };

  return (
    <div className="relative mx-4 mt-2 mb-2 md:hidden" data-banner="username-setup">
      <div
        className={`wewrite-card px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsing ? 'max-h-0 py-0 opacity-0 transform -translate-y-4 scale-95' : 'max-h-32 opacity-100 transform translate-y-0 scale-100'
        }`}
      >
        <div className="flex items-center space-x-2 mb-2">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Choose your username</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-xs text-foreground"
            onClick={handleLater}
          >
            Later
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-9 text-xs"
            onClick={handleSetUsername}
          >
            <span>Set up</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
