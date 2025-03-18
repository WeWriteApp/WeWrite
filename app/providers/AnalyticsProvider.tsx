'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeAnalytics } from '../firebase/config';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [analyticsInitialized, setAnalyticsInitialized] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Firebase Analytics only on the client side
    const setupAnalytics = async () => {
      try {
        // Debug information
        console.log('Analytics provider initializing...');
        console.log('Firebase measurement ID:', process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
        
        const analytics = await initializeAnalytics();
        
        if (analytics) {
          console.log('Firebase Analytics initialized successfully');
          // Check if we can track events
          try {
            // @ts-ignore - logEvent might not be exposed directly
            analytics.logEvent('analytics_debug', {
              debug_time: new Date().toISOString(),
              debug_source: 'analytics_provider'
            });
            console.log('Test event logged successfully');
          } catch (eventError) {
            console.error('Failed to log test event:', eventError);
            setAnalyticsError(`Event logging error: ${eventError}`);
          }
          
          setAnalyticsInitialized(true);
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

  // Add some debugging UI in development
  if (process.env.NODE_ENV === 'development') {
    return (
      <>
        {children}
        {/* Development-only debugging indicator */}
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: analyticsInitialized ? '#4caf50' : '#f44336', 
          color: 'white', 
          padding: '4px 8px', 
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 9999,
          opacity: 0.7
        }}>
          Analytics: {analyticsInitialized ? 'Initialized' : 'Failed'}
          {analyticsError && (
            <div style={{ fontSize: '10px', maxWidth: '200px', wordBreak: 'break-word' }}>
              {analyticsError}
            </div>
          )}
        </div>
      </>
    );
  }

  return <>{children}</>;
} 