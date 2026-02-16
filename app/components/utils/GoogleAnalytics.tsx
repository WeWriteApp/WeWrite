'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getAnalyticsPageTitle } from "../../utils/analytics-page-titles";

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

  // Skip Google Analytics in development to prevent authentication errors
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // Log initialization attempt
  useEffect(() => {

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

      // Get a standardized page title for analytics
      const pageTitle = getAnalyticsPageTitle(pathname, searchParams, document.title);

      window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
        page_title: pageTitle,
        page_location: window.location.href
      });

      setInitialized(true);
    } catch (err) {
      console.error('Error tracking pageview:', err);
      setError(`${err}`);
    }
  }, [pathname, searchParams, GA_MEASUREMENT_ID]);

  // Debug onLoad/onError handlers
  const handleScriptLoad = () => {
    setInitialized(true);
  };

  const handleScriptError = (error: any) => {
    console.warn('Failed to load Google Analytics script (likely blocked by ad blocker):', error);
    // Don't set error state for script loading failures as they're often due to ad blockers
    // setError('Script load failed');

    // Instead, just log and continue gracefully
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
          `}}
      />

      {/* Analytics debugging indicator - hidden by default */}
      {false && process.env.NODE_ENV === 'development' && (
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