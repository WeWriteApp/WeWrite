'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeAnalytics } from "../../firebase/config';
import { logEvent } from 'firebase/analytics';
import { usePathname, useSearchParams } from "next/navigation';
import { getAnalyticsPageTitle, getAnalyticsPageTitleForId } from "../../utils/analytics-page-titles';

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
          console.warn('Firebase Analytics initialized but returned null - might be blocked by browser or ad blocker');
          // Don't set error state for analytics blocking as it's common and expected
          // setAnalyticsError('Firebase Analytics returned null');
        }
      } catch (error) {
        console.warn('Failed to initialize Firebase Analytics (likely blocked by ad blocker):', error);
        // Don't set error state for analytics failures as they're often due to ad blockers
        // setAnalyticsError(`${error}`);
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

      // Get a standardized page title for analytics
      const pageTitle = getAnalyticsPageTitle(pathname, searchParams, document.title);

      // Extract page ID if this is a page route
      const pageId = pathname ? pathname.match(/\/([a-zA-Z0-9]{20})(?:\/|$)/)?.at(1) : null;

      // Log page view event with page title
      logEvent(analyticsInstance, 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: url
      });

      // For page routes with ID-based titles, try to get a better title asynchronously
      if (pageId && pageTitle === `Page: ${pageId}`) {
        try {
          getAnalyticsPageTitleForId(pageId).then(betterTitle => {
            if (betterTitle !== `Page: ${pageId}`) {
              // Re-track with the better title
              logEvent(analyticsInstance, 'page_view', {
                page_title: betterTitle,
                page_location: window.location.href,
                page_path: url
              });

              if (process.env.NODE_ENV === 'development') {
                console.log('Firebase Analytics re-tracked with better title:', betterTitle);
              }
            }
          });
        } catch (titleErr) {
          console.error('Error getting better page title for Firebase Analytics:', titleErr);
        }
      }

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
          pointerEvents: "none"
        }}>
          Firebase Analytics Error: {analyticsError}
        </div>
      )}
    </>
  );
}