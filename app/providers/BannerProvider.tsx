"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePWA } from './PWAProvider';
import { isValidUsername } from '../hooks/useUsernameStatus';
import { useEmailVerificationStatus } from '../hooks/useEmailVerificationStatus';

// Banner height constants - should match the actual rendered heights
const EMAIL_BANNER_HEIGHT = 40;
const PWA_BANNER_HEIGHT = 48;
const USERNAME_BANNER_HEIGHT = 40; // Same as email banner
const SAVE_BANNER_HEIGHT = 56; // Save/revert banner height

interface BannerContextType {
  showEmailBanner: boolean;
  showPWABanner: boolean;
  showUsernameBanner: boolean;
  showSaveBanner: boolean;
  bannerOffset: number;
  setEmailBannerDismissed: () => void;
  setUsernameBannerDismissed: () => void;
  setSaveBannerVisible: (visible: boolean) => void;
}

const BannerContext = createContext<BannerContextType>({
  showEmailBanner: false,
  showPWABanner: false,
  showUsernameBanner: false,
  showSaveBanner: false,
  bannerOffset: 0,
  setEmailBannerDismissed: () => {},
  setUsernameBannerDismissed: () => {},
  setSaveBannerVisible: () => {},
});

export const useBanner = () => useContext(BannerContext);

const STORAGE_KEYS = {
  USERNAME_BANNER_DISMISSED_TIMESTAMP: 'wewrite_username_banner_dismissed_timestamp',
  USERNAME_DONT_REMIND: 'wewrite_username_dont_remind',
};

export const BannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showBanner: pwaBannerShouldShow } = usePWA();

  // Use the same hook as EmailVerificationTopBanner for synchronized state
  const emailVerificationStatus = useEmailVerificationStatus();

  const [showPWABanner, setShowPWABanner] = useState(false);
  const [showUsernameBanner, setShowUsernameBanner] = useState(false);
  // Save banner state - controlled by StickySaveHeader via setSaveBannerVisible
  const [showSaveBanner, setShowSaveBanner] = useState(false);

  // Email banner state is now directly from the hook (single source of truth)
  const showEmailBanner = emailVerificationStatus.shouldShowBanner && !emailVerificationStatus.isLoading;

  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      setShowPWABanner(false);
      setShowUsernameBanner(false);
      return;
    }

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
      // Username banner shows if email banner is NOT showing
      const usernameBannerShouldShow = !showEmailBanner && shouldShowUsernameBanner();
      setShowUsernameBanner(usernameBannerShouldShow);

      // PWA banner only shows if other banners are NOT showing
      // This implements the "one thing at a time" priority system
      setShowPWABanner(!showEmailBanner && !usernameBannerShouldShow && pwaBannerShouldShow);
    };

    // Initial update
    updateBannerStates();

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.USERNAME_DONT_REMIND ||
          e.key === STORAGE_KEYS.USERNAME_BANNER_DISMISSED_TIMESTAMP) {
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
  }, [user, pwaBannerShouldShow, showEmailBanner]);

  const setEmailBannerDismissed = () => {
    // Email banner dismissal is now handled by the hook/modal system
    // The useEmailVerificationStatus hook responds to localStorage changes
    // This callback is kept for API compatibility but the state is managed by the hook
    // After email banner is dismissed, the useEffect will automatically show the next banner
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

  // Calculate banner offset based on which banners are showing
  // System banners (email/username/PWA) are mutually exclusive (priority system)
  // Save banner ALWAYS adds to the offset when visible (stacks at bottom of banner area)
  const systemBannerOffset = showEmailBanner ? EMAIL_BANNER_HEIGHT
    : showUsernameBanner ? USERNAME_BANNER_HEIGHT
    : showPWABanner ? PWA_BANNER_HEIGHT
    : 0;

  // Save banner stacks below system banners
  const bannerOffset = systemBannerOffset + (showSaveBanner ? SAVE_BANNER_HEIGHT : 0);

  // Update the unified CSS variable for banner stack height
  // This is used by StickySaveHeader and other components that need to position below banners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.style.setProperty('--banner-stack-height', `${bannerOffset}px`);

    return () => {
      document.documentElement.style.setProperty('--banner-stack-height', '0px');
    };
  }, [bannerOffset]);

  // Callback for StickySaveHeader to register its visibility
  const setSaveBannerVisible = (visible: boolean) => {
    setShowSaveBanner(visible);
  };

  return (
    <BannerContext.Provider value={{
      showEmailBanner,
      showPWABanner,
      showUsernameBanner,
      showSaveBanner,
      bannerOffset,
      setEmailBannerDismissed,
      setUsernameBannerDismissed,
      setSaveBannerVisible,
    }}>
      {children}
    </BannerContext.Provider>
  );
};
