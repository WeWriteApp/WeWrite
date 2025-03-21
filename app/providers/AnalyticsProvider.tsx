'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeAnalytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';

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
            // Use imported logEvent function instead of analytics.logEvent
            logEvent(analytics, 'analytics_debug', {
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

  // Debug output for development
  useEffect(() => {
    console.log('Analytics: ' + (analyticsInitialized ? 'Initialized' : 'Not initialized'));
    if (analyticsError) {
      console.log('Event logging error:', analyticsError);
    }
  }, [analyticsInitialized, analyticsError]);

  // We don't need to wrap children in a context provider
  // since we're just initializing analytics at the app level
  return <>{children}</>;
}