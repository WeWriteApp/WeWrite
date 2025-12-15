"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePWA } from './PWAProvider';
import { isValidUsername } from '../hooks/useUsernameStatus';

// Banner height constant - should match the actual rendered height
const BANNER_HEIGHT = 40;

interface BannerContextType {
  showEmailBanner: boolean;
  showPWABanner: boolean;
  showUsernameBanner: boolean;
  bannerOffset: number;
  setEmailBannerDismissed: () => void;
  setUsernameBannerDismissed: () => void;
}

const BannerContext = createContext<BannerContextType>({
  showEmailBanner: false,
  showPWABanner: false,
  showUsernameBanner: false,
  bannerOffset: 0,
  setEmailBannerDismissed: () => {},
  setUsernameBannerDismissed: () => {},
});

export const useBanner = () => useContext(BannerContext);

const STORAGE_KEYS = {
  EMAIL_BANNER_DISMISSED: 'wewrite_email_banner_dismissed',
  EMAIL_BANNER_DISMISSED_TIMESTAMP: 'wewrite_email_banner_dismissed_timestamp',
  EMAIL_DONT_REMIND: 'wewrite_email_dont_remind',
  ADMIN_EMAIL_BANNER_OVERRIDE: 'wewrite_admin_email_banner_override',
  USERNAME_BANNER_DISMISSED_TIMESTAMP: 'wewrite_username_banner_dismissed_timestamp',
  USERNAME_DONT_REMIND: 'wewrite_username_dont_remind',
};

export const BannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showBanner: pwaBannerShouldShow } = usePWA();
  const [showEmailBanner, setShowEmailBanner] = useState(false);
  const [showPWABanner, setShowPWABanner] = useState(false);
  const [showUsernameBanner, setShowUsernameBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      setShowEmailBanner(false);
      setShowPWABanner(false);
      setShowUsernameBanner(false);
      return;
    }

    // Check if email verification banner should show
    const shouldShowEmailBanner = () => {
      // Check for admin override first
      const adminOverride = localStorage.getItem(STORAGE_KEYS.ADMIN_EMAIL_BANNER_OVERRIDE);
      if (adminOverride === 'true') return true;

      // Only show if email is not verified
      if (user.emailVerified) return false;

      // Check if user has chosen "Don't remind me"
      if (localStorage.getItem(STORAGE_KEYS.EMAIL_DONT_REMIND) === 'true') return false;

      // Check if banner was recently dismissed with "Later"
      const dismissedTimestamp = localStorage.getItem(STORAGE_KEYS.EMAIL_BANNER_DISMISSED_TIMESTAMP);
      if (dismissedTimestamp) {
        const dismissedTime = parseInt(dismissedTimestamp, 10);
        const currentTime = Date.now();

        // If dismissed less than 1 day ago, don't show
        if (currentTime - dismissedTime < 1 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    };

    // Check if username banner should show
    const shouldShowUsernameBanner = () => {
      // Check if user has a valid username
      const currentUsername = user.username || '';
      if (isValidUsername(currentUsername)) return false;

      // Check if user has chosen "Don't remind me"
      if (localStorage.getItem(STORAGE_KEYS.USERNAME_DONT_REMIND) === 'true') return false;

      // Check if banner was recently dismissed
      const dismissedTimestamp = localStorage.getItem(STORAGE_KEYS.USERNAME_BANNER_DISMISSED_TIMESTAMP);
      if (dismissedTimestamp) {
        const dismissedTime = parseInt(dismissedTimestamp, 10);
        const currentTime = Date.now();

        // If dismissed less than 3 days ago, don't show
        if (currentTime - dismissedTime < 3 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    };

    const updateBannerStates = () => {
      const emailBannerShouldShow = shouldShowEmailBanner();
      setShowEmailBanner(emailBannerShouldShow);

      // Username banner shows if email banner is NOT showing
      const usernameBannerShouldShow = !emailBannerShouldShow && shouldShowUsernameBanner();
      setShowUsernameBanner(usernameBannerShouldShow);

      // PWA banner only shows if other banners are NOT showing
      // This implements the "one thing at a time" priority system
      setShowPWABanner(!emailBannerShouldShow && !usernameBannerShouldShow && pwaBannerShouldShow);
    };

    // Initial update
    updateBannerStates();

    // Listen for localStorage changes (for admin override)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ADMIN_EMAIL_BANNER_OVERRIDE) {
        updateBannerStates();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events for same-tab changes
    const handleCustomStorageChange = () => {
      updateBannerStates();
    };

    window.addEventListener('bannerOverrideChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannerOverrideChange', handleCustomStorageChange);
    };
  }, [user, pwaBannerShouldShow]);

  const setEmailBannerDismissed = () => {
    setShowEmailBanner(false);
    // After email banner is dismissed, check if username or PWA banner should show
    if (typeof window !== 'undefined') {
      const currentUsername = user?.username || '';
      const shouldShowUsername = !isValidUsername(currentUsername) && 
        localStorage.getItem(STORAGE_KEYS.USERNAME_DONT_REMIND) !== 'true';
      
      if (shouldShowUsername) {
        setShowUsernameBanner(true);
      } else {
        setShowPWABanner(pwaBannerShouldShow);
      }
    }
  };

  const setUsernameBannerDismissed = () => {
    setShowUsernameBanner(false);
    // After username banner is dismissed, check if PWA banner should show
    setShowPWABanner(pwaBannerShouldShow);
  };

  // Calculate banner offset based on which banner is showing
  // Only one banner shows at a time due to priority system
  const bannerOffset = (showEmailBanner || showUsernameBanner || showPWABanner) ? BANNER_HEIGHT : 0;

  return (
    <BannerContext.Provider value={{
      showEmailBanner,
      showPWABanner,
      showUsernameBanner,
      bannerOffset,
      setEmailBannerDismissed,
      setUsernameBannerDismissed,
    }}>
      {children}
    </BannerContext.Provider>
  );
};
