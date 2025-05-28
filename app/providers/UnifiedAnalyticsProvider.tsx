'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { getAnalyticsInstance } from "../../utils/analytics';
import { useRouter } from "next/navigation';
import {
  getAnalyticsPageTitle,
  getAnalyticsPageTitleForId,
  trackPageViewWhenReady,
  isContentReadyForAnalytics
} from "../../utils/analytics-page-titles';

/**
 * UnifiedAnalyticsProvider
 *
 * This component handles analytics initialization and automatic tracking of page views.
 * It serves as a bridge between the Next.js app router and our analytics implementation.
 *
 * Key features:
 * 1. Loads Google Analytics script
 * 2. Initializes our unified analytics service
 * 3. Automatically tracks page views when routes change
 * 4. Includes page titles in analytics data for better reporting
 * 5. Provides debugging UI in development mode
 */
interface UnifiedAnalyticsProviderProps {
  children: ReactNode;
}

export function UnifiedAnalyticsProvider({ children }: UnifiedAnalyticsProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Reference to track the current document title
  const documentTitleRef = useRef<string>('');

  const analytics = getAnalyticsInstance();
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
  const isDev = process.env.NODE_ENV === 'development';

  // Initial setup - runs once when component mounts
  useEffect(() => {
    if (isDev) console.log('UnifiedAnalyticsProvider initializing...');

    const setup = async () => {
      try {
        if (!GA_MEASUREMENT_ID) {
          if (isDev) console.warn('Missing Google Analytics Measurement ID');
          setError('Missing GA ID');
        }

        // Get debug info from analytics instance
        const analyticsStatus = analytics.debugStatus();
        setStatus(analyticsStatus);

        // Mark as successfully initialized
        setInitialized(true);

      } catch (err) {
        console.error('Error initializing analytics:', err);
        setError(`${err}`);
      }
    };

    if (typeof window !== 'undefined') {
      setup();
    }
  }, [analytics, GA_MEASUREMENT_ID, isDev]);

  // Monitor document title changes to improve analytics accuracy
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Store initial document title
    documentTitleRef.current = document.title;

    // Set up a MutationObserver to watch for title changes
    const titleObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.target === document.querySelector('title') ||
          (mutation.addedNodes.length &&
            Array.from(mutation.addedNodes).some(node =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node as Element).tagName === 'TITLE')
          )
        ) {
          const newTitle = document.title;
          if (newTitle !== documentTitleRef.current) {
            documentTitleRef.current = newTitle;
            if (isDev) console.log('Document title changed to:', newTitle);

            // Re-track the current page with the new title
            if (initialized && pathname) {
              const url = pathname + (searchParams?.toString() || '');
              const pageId = extractPageId(pathname);

              if (pageId) {
                // For content pages, use our improved tracking
                const { isReady, title } = isContentReadyForAnalytics(pageId, newTitle);

                if (isReady && title !== 'Page: Loading Content') {
                  // Content is ready, track with the verified title
                  analytics.pageView(url, title, pageId);
                  if (isDev) console.log('Re-tracked page view with verified title:', title);
                } else {
                  // Content is not ready, use delayed tracking
                  trackPageViewWhenReady(pageId, newTitle);
                }
              } else {
                // For non-content pages, track normally
                analytics.pageView(url, newTitle, pageId);
                if (isDev) console.log('Re-tracked page view with updated title:', newTitle);
              }
            }
          }
        }
      });
    });

    // Start observing title changes
    titleObserver.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true
    });

    return () => {
      titleObserver.disconnect();
    };
  }, [initialized, pathname, searchParams, analytics, isDev]);

  // Track page views - runs whenever the route changes
  useEffect(() => {
    if (!initialized || !pathname) return;

    try {
      // Construct the full URL
      const url = pathname + (searchParams?.toString() || '');

      // Get a standardized page title for analytics
      const pageTitle = typeof document !== "undefined"
        ? getAnalyticsPageTitle(pathname, searchParams, document.title)
        : getPageTitle(pathname);

      // Store the current title
      if (typeof document !== 'undefined') {
        documentTitleRef.current = document.title;
      }

      // Extract page ID from URL if present (for pages/[id] routes)
      const pageId = extractPageId(pathname);

      // For content pages, use our improved tracking that waits for content to be ready
      if (pageId && (pathname.includes('/pages/') || pathname.match(/\/[a-zA-Z0-9]{20}/))) {
        // Check if content is ready for tracking
        const { isReady, title } = isContentReadyForAnalytics(pageId, pageTitle);

        if (isReady && title !== 'Page: Loading Content') {
          // Content is ready, track immediately with the verified title
          analytics.pageView(url, title, pageId);
          if (isDev) console.log('Page view tracked with verified content:', title);
        } else {
          // Content is not ready, use delayed tracking
          if (isDev) console.log('Content not ready, using delayed tracking');

          // Start the delayed tracking process
          trackPageViewWhenReady(pageId, pageTitle);

          // Don't track with placeholder title to avoid "Page: Loading Content" in analytics
          // The trackPageViewWhenReady function will handle the actual tracking when content is ready
        }
      } else {
        // For non-page routes, just track normally
        analytics.pageView(url, pageTitle, pageId);
      }

      if (isDev) console.log('Page view tracked:', url, pageTitle ? `(${pageTitle})` : '');
    } catch (err) {
      console.error('Error tracking page view:', err);
    }
  }, [pathname, searchParams, initialized, analytics, isDev]);

  // Handlers for script loading
  const handleGAScriptLoad = () => {
    if (isDev) console.log('Google Analytics script loaded successfully');
  };

  const handleGAScriptError = (error: any) => {
    console.warn('Failed to load Google Analytics script (likely blocked by ad blocker):', error);
    // Don't set error state for script loading failures as they're often due to ad blockers
    // setError('GA script failed to load');

    // Instead, just log and continue gracefully
    if (isDev) console.log('Continuing without Google Analytics due to script loading failure');
  };

  /**
   * Helper function to determine page title from URL when document is not available
   * This is a server-side fallback for the client-side getAnalyticsPageTitle function
   */
  const getPageTitle = (path: string): string => {
    // Extract section from URL
    const sections = path.split('/').filter(Boolean);

    // Use the same mapping logic as in analytics-page-titles.ts
    // but without DOM access

    // Check static routes first
    if (path === '/') return 'Home Page';

    // Handle dynamic routes
    if (sections[0] === 'pages' && sections.length > 1) {
      return `Page: ${sections[1]}`;
    }

    if (sections[0] === 'user' && sections.length > 1) {
      return `User: ${sections[1]}`;
    }

    if (sections[0] === 'g' && sections.length > 1) {
      return `Group: ${sections[1]}`;
    }

    // Auth routes
    if (sections[0] === 'auth') {
      if (sections[1] === 'login') return 'Login Page';
      if (sections[1] === 'register') return 'Registration Page';
      if (sections[1] === 'forgot-password') return 'Password Reset Page';
      if (sections[1] === 'switch-account') return 'Account Switcher';
      if (sections[1] === 'logout') return 'Logout Page';
    }

    // Fallback to capitalized path segment
    if (sections.length > 0) {
      const lastSegment = sections[sections.length - 1];
      return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' ');
    }

    return 'Unknown Page';
  };

  /**
   * Helper function to extract page ID from URL
   * This helps with tracking specific pages
   */
  const extractPageId = (path: string): string | null => {
    if (!path) return null;

    // Check for /pages/[id] format
    const pagesMatch = path.match(/\/pages\/([a-zA-Z0-9-_]+)/);
    if (pagesMatch && pagesMatch[1]) return pagesMatch[1];

    // Check for direct UUID format (20 chars)
    const uuidMatch = path.match(/\/([a-zA-Z0-9]{20})(?:\/|$)/);
    if (uuidMatch && uuidMatch[1]) return uuidMatch[1];

    return null;
  };

  return (
    <>
      {/* Google Analytics Script - needed for gtag to be available globally */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            onLoad={handleGAScriptLoad}
            onError={handleGAScriptError}
          />
          <Script
            id="google-analytics-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                // Google Analytics Base Configuration
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  // Ensure we're collecting page titles for data science team
                  send_page_view: false, // We'll track manually to include titles
                });
                console.log(\`Google Analytics initialized with ID: \${GA_MEASUREMENT_ID}\`);
              `,
            }}
          />
        </>
      )}

      {/* Children content */}
      {children}

      {/* Development-only debug indicator */}
      {isDev && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: '#333',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 9999,
          opacity: 0.8,
          maxWidth: '250px',
        }}>
          <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
            Analytics: {initialized ? '✅' : '❌'}
            {error && <span style={{ color: '#ff4d4d' }}> (Error)</span>}
          </div>

          {status && (
            <div style={{ fontSize: '10px', wordBreak: 'break-word' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Google Analytics:</span>
                <span style={{ color: status.gaAvailable ? '#4caf50' : '#ff4d4d' }}>
                  {status.gaAvailable ? 'Ready' : 'Not available'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Firebase Analytics:</span>
                <span style={{ color: status.fbAvailable ? '#4caf50' : '#ff4d4d' }}>
                  {status.fbAvailable ? 'Ready' : 'Not available'}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '9px' }}>
                Path: {pathname || 'none'}
              </div>
              <div style={{ marginTop: '2px', fontSize: '9px' }}>
                Title: {typeof document !== 'undefined' ? document.title : 'N/A'}
              </div>
              {error && <div style={{ color: '#ff4d4d', marginTop: '4px' }}>{error}</div>}
            </div>
          )}
        </div>
      )}
    </>
  );
}