"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePWA } from './PWAProvider';
import { isValidUsername } from '../hooks/useUsernameStatus';

interface BannerContextType {
  showEmailBanner: boolean;
  showPWABanner: boolean;
  showUsernameBanner: boolean;
  setEmailBannerDismissed: () => void;
  setUsernameBannerDismissed: () => void;
  bannerOffset: number;
}

const BannerContext = createContext<BannerContextType>({
  showEmailBanner: false,
  showPWABanner: false,
  showUsernameBanner: false,
  setEmailBannerDismissed: () => {},
  setUsernameBannerDismissed: () => {},
  bannerOffset: 0
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
  const [scrollY, setScrollY] = useState(0);
  const [bannerHeight, setBannerHeight] = useState(0);

  // Track scroll position with throttling for performance
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Detect banner height when banners are visible
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectBannerHeight = () => {
      // Look for banner elements in the DOM
      const emailBanner = document.querySelector('[data-banner="email-verification"]');
      const pwaBanner = document.querySelector('[data-banner="pwa-installation"]');
      const usernameBanner = document.querySelector('[data-banner="username-setup"]');

      let totalHeight = 0;

      if (emailBanner && showEmailBanner) {
        totalHeight += emailBanner.getBoundingClientRect().height;
      }

      if (pwaBanner && showPWABanner) {
        totalHeight += pwaBanner.getBoundingClientRect().height;
      }

      if (usernameBanner && showUsernameBanner) {
        totalHeight += usernameBanner.getBoundingClientRect().height;
      }

      setBannerHeight(totalHeight);
    };

    // Initial detection
    detectBannerHeight();

    // Re-detect when banners change
    const observer = new MutationObserver(detectBannerHeight);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, [showEmailBanner, showPWABanner, showUsernameBanner]);

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

  // Calculate dynamic banner offset for scroll-aware positioning
  const bannerOffset = React.useMemo(() => {
    // Only apply offset on mobile where banners are shown
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return 0; // No banners on desktop
    }

    // If no banners are showing, no offset needed
    if (!showEmailBanner && !showPWABanner && !showUsernameBanner) {
      return 0;
    }

    // Use detected banner height, fallback to estimated height based on visible banners
    let estimatedHeight = 0;
    if (showEmailBanner) estimatedHeight += 88; // ~80px content + 8px margins
    if (showUsernameBanner) estimatedHeight += 88; // ~80px content + 8px margins
    if (showPWABanner) estimatedHeight += 88; // ~80px content + 8px margins

    const totalBannerHeight = bannerHeight || estimatedHeight;

    // Calculate how much of the banner is still visible
    // If user has scrolled past the banner, reduce the offset
    const visibleBannerHeight = Math.max(0, totalBannerHeight - scrollY);

    return visibleBannerHeight;
  }, [showEmailBanner, showPWABanner, showUsernameBanner, bannerHeight, scrollY]);

  return (
    <BannerContext.Provider value={{
      showEmailBanner,
      showPWABanner,
      showUsernameBanner,
      setEmailBannerDismissed,
      setUsernameBannerDismissed,
      bannerOffset
    }}>
      {children}
    </BannerContext.Provider>
  );
};
