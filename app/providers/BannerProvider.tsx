"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePWA } from './PWAProvider';

interface BannerContextType {
  showEmailBanner: boolean;
  showPWABanner: boolean;
  setEmailBannerDismissed: () => void;
  bannerOffset: number;
}

const BannerContext = createContext<BannerContextType>({
  showEmailBanner: false,
  showPWABanner: false,
  setEmailBannerDismissed: () => {},
  bannerOffset: 0
});

export const useBanner = () => useContext(BannerContext);

const STORAGE_KEYS = {
  EMAIL_BANNER_DISMISSED: 'wewrite_email_banner_dismissed',
  EMAIL_BANNER_DISMISSED_TIMESTAMP: 'wewrite_email_banner_dismissed_timestamp',
  EMAIL_DONT_REMIND: 'wewrite_email_dont_remind',
  ADMIN_EMAIL_BANNER_OVERRIDE: 'wewrite_admin_email_banner_override'
};

export const BannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showBanner: pwaBannerShouldShow } = usePWA();
  const [showEmailBanner, setShowEmailBanner] = useState(false);
  const [showPWABanner, setShowPWABanner] = useState(false);
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

      let totalHeight = 0;

      if (emailBanner && showEmailBanner) {
        totalHeight += emailBanner.getBoundingClientRect().height;
      }

      if (pwaBanner && showPWABanner) {
        totalHeight += pwaBanner.getBoundingClientRect().height;
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
  }, [showEmailBanner, showPWABanner]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      setShowEmailBanner(false);
      setShowPWABanner(false);
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

    const updateBannerStates = () => {
      const emailBannerShouldShow = shouldShowEmailBanner();
      setShowEmailBanner(emailBannerShouldShow);

      // PWA banner only shows if email banner is NOT showing
      // This implements the "one thing at a time" priority system
      setShowPWABanner(!emailBannerShouldShow && pwaBannerShouldShow);
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
    // After email banner is dismissed, check if PWA banner should show
    setShowPWABanner(pwaBannerShouldShow);
  };

  // Calculate dynamic banner offset for scroll-aware positioning
  const bannerOffset = React.useMemo(() => {
    // Only apply offset on mobile where banners are shown
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return 0; // No banners on desktop
    }

    // If no banners are showing, no offset needed
    if (!showEmailBanner && !showPWABanner) {
      return 0;
    }

    // Use detected banner height, fallback to estimated 80px
    const totalBannerHeight = bannerHeight || 80;

    // Calculate how much of the banner is still visible
    // If user has scrolled past the banner, reduce the offset
    const visibleBannerHeight = Math.max(0, totalBannerHeight - scrollY);

    return visibleBannerHeight;
  }, [showEmailBanner, showPWABanner, bannerHeight, scrollY]);

  return (
    <BannerContext.Provider value={{
      showEmailBanner,
      showPWABanner,
      setEmailBannerDismissed,
      bannerOffset
    }}>
      {children}
    </BannerContext.Provider>
  );
};
