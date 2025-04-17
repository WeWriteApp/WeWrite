'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Declare global gtag function
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, any>
    ) => void;
    dataLayer: any[];
  }
}

export default function GoogleAnalytics({ GA_MEASUREMENT_ID }: { GA_MEASUREMENT_ID: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log initialization attempt
  useEffect(() => {
    console.log('Google Analytics component mounting with ID:', GA_MEASUREMENT_ID);

    if (!GA_MEASUREMENT_ID) {
      console.error('Missing Google Analytics Measurement ID');
      setError('Missing GA ID');
      return;
    }
  }, [GA_MEASUREMENT_ID]);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) {
      if (!window.gtag) {
        console.error('Google Tag Manager not loaded (window.gtag not available)');
        setError('GTM not loaded');
      }
      return;
    }

    try {
      const url = pathname + searchParams.toString();

      // Get the current page title
      let pageTitle = document.title;

      // Make sure we have a meaningful title
      if (!pageTitle || pageTitle === '' || pageTitle === 'WeWrite') {
        // Map of standardized page titles for analytics
        const pageTitleMap = {
          '/': 'WeWrite - Home',
          '/new': 'WeWrite - Create New Page',
          '/direct-create': 'WeWrite - Create New Page',
          '/direct-reply': 'WeWrite - Reply to Page',
          '/auth/login': 'WeWrite - Sign In',
          '/auth/register': 'WeWrite - Create Account',
          '/auth/forgot-password': 'WeWrite - Reset Password',
          '/auth/switch-account': 'WeWrite - Switch Account',
          '/auth/logout': 'WeWrite - Sign Out',
          '/account': 'WeWrite - Account Settings',
          '/account/subscription': 'WeWrite - Subscription Settings',
          '/activity': 'WeWrite - Activity Feed',
          '/sandbox': 'WeWrite - Sandbox',
          '/leaderboard': 'WeWrite - Leaderboard'
        };

        // Check if we have a predefined title for this path
        if (pageTitleMap[pathname]) {
          pageTitle = pageTitleMap[pathname];
        }
        // Handle dynamic routes
        else if (pathname.startsWith('/user/')) {
          // For user profile pages
          const username = document.querySelector('h1')?.textContent;
          if (username) {
            pageTitle = `WeWrite - User Profile: ${username}`;
          } else {
            pageTitle = 'WeWrite - User Profile';
          }
        }
        else if (pathname.match(/\/[a-zA-Z0-9]{20}/) || pathname.includes('/pages/')) {
          // For content pages, get a specific title
          const contentTitle = document.querySelector('h1')?.textContent;
          if (contentTitle && contentTitle !== 'Untitled') {
            pageTitle = `WeWrite - Page: ${contentTitle}`;
          } else {
            // Check if we're in edit mode
            if (searchParams?.has('edit')) {
              pageTitle = 'WeWrite - Page Editor';
            } else {
              // Extract the page ID for a more descriptive title
              const pageId = pathname.split('/').pop();
              pageTitle = `WeWrite - Page: ${pageId}`;
            }
          }
        }
        // Ensure we never have "Untitled" in analytics
        else if (pageTitle.includes('Untitled')) {
          // Extract the path segment for a more descriptive title
          const pathSegment = pathname.split('/').filter(Boolean).pop() || 'page';
          pageTitle = `WeWrite - ${pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1)}`;
        }
        // Fallback for any other page
        else {
          const pathSegment = pathname.split('/').filter(Boolean).pop() || 'page';
          pageTitle = `WeWrite - ${pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1)}`;
        }
      }

      window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
        page_title: pageTitle,
        page_location: window.location.href
      });

      console.log('Google Analytics pageview tracked:', url, 'with title:', pageTitle);
      setInitialized(true);
    } catch (err) {
      console.error('Error tracking pageview:', err);
      setError(`${err}`);
    }
  }, [pathname, searchParams, GA_MEASUREMENT_ID]);

  // Debug onLoad/onError handlers
  const handleScriptLoad = () => {
    console.log('Google Analytics script loaded successfully');
    setInitialized(true);
  };

  const handleScriptError = () => {
    console.error('Failed to load Google Analytics script');
    setError('Script load failed');
  };

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        onLoad={handleScriptLoad}
        onError={handleScriptError}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        onLoad={() => console.log('Google Analytics config script loaded')}
        onError={() => console.error('Google Analytics config script failed to load')}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              send_page_view: false
            });
            console.log('Google Analytics config initialized');
          `,
        }}
      />

      {/* Development-only debugging indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          right: '10px',
          background: initialized ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          GA: {initialized ? '✓' : '✗'} {error ? `(${error})` : ''}
        </div>
      )}
    </>
  );
}