'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeAnalytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';
import { usePathname, useSearchParams } from 'next/navigation';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [analyticsInitialized, setAnalyticsInitialized] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsInstance, setAnalyticsInstance] = useState<any>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize Firebase Analytics only on the client side
    const setupAnalytics = async () => {
      try {
        // Debug information
        if (process.env.NODE_ENV === 'development') {
          console.log('Analytics provider initializing...');
        }

        const analytics = await initializeAnalytics();

        if (analytics) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Firebase Analytics initialized successfully');
          }

          setAnalyticsInitialized(true);
          setAnalyticsInstance(analytics);
        } else {
          console.warn('Firebase Analytics initialized but returned null - might be blocked by browser');
          setAnalyticsError('Firebase Analytics returned null');
        }
      } catch (error) {
        console.error('Failed to initialize Firebase Analytics:', error);
        setAnalyticsError(`${error}`);
      }
    };

    if (typeof window !== 'undefined') {
      setupAnalytics();
    }
  }, []);

  // Track page views with correct page titles
  useEffect(() => {
    if (!analyticsInitialized || !analyticsInstance || typeof window === 'undefined') {
      return;
    }

    try {
      const url = pathname + (searchParams?.toString() || '');

      // Get the current page title
      let pageTitle = document.title;

      // For specific routes, we can set more descriptive titles
      if (pathname === '/') {
        pageTitle = 'WeWrite - Home';
      } else if (pathname.startsWith('/auth/login')) {
        pageTitle = 'WeWrite - Sign In';
      } else if (pathname.startsWith('/auth/register')) {
        pageTitle = 'WeWrite - Create Account';
      } else if (pathname.startsWith('/auth/forgot-password')) {
        pageTitle = 'WeWrite - Reset Password';
      } else if (pathname.startsWith('/auth/switch-account')) {
        pageTitle = 'WeWrite - Switch Account';
      } else if (pathname.startsWith('/auth/logout')) {
        pageTitle = 'WeWrite - Sign Out';
      } else if (pathname.startsWith('/account/subscription')) {
        pageTitle = 'WeWrite - Subscription Settings';
      } else if (pathname.startsWith('/account')) {
        pageTitle = 'WeWrite - Account Settings';
      } else if (pathname.startsWith('/pages/')) {
        // For content pages, try to get a more specific title
        const contentTitle = document.querySelector('h1')?.textContent;
        if (contentTitle) {
          pageTitle = `WeWrite - ${contentTitle}`;
        } else {
          pageTitle = 'WeWrite - Content Page';
        }
      }

      // Log page view event with page title
      logEvent(analyticsInstance, 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: url
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Firebase Analytics page view tracked:', url, 'with title:', pageTitle);
      }
    } catch (error) {
      console.error('Error tracking Firebase Analytics page view:', error);
    }
  }, [pathname, searchParams, analyticsInitialized, analyticsInstance]);

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && analyticsError && (
        <div style={{
          position: 'fixed',
          bottom: '60px',
          right: '10px',
          background: 'rgba(255,0,0,0.2)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          Firebase Analytics Error: {analyticsError}
        </div>
      )}
    </>
  );
}