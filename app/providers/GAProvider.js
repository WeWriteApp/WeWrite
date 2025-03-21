"use client";
import React, { useEffect, useState } from "react";
import ReactGA from 'react-ga4';
import { usePathname, useSearchParams } from 'next/navigation';
import { initializeGA, trackPageView } from '@/utils/ga';

export default function GAProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Google Analytics only once
  useEffect(() => {
    const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    
    if (!GA_TRACKING_ID) {
      console.warn('Missing Google Analytics Measurement ID in .env.local');
      return;
    }
    
    try {
      // Check if GA has already been initialized to avoid duplicate initialization
      if (!window.GA_INITIALIZED) {
        console.log('Initializing Google Analytics with ID:', GA_TRACKING_ID);
        
        // Force debug mode in development
        const debugMode = process.env.NODE_ENV === 'development';
        
        ReactGA.initialize(GA_TRACKING_ID, {
          gaOptions: {
            debug_mode: debugMode
          },
          testMode: process.env.NODE_ENV !== 'production'
        });
        
        // Mark as initialized
        window.GA_INITIALIZED = true;
        setIsInitialized(true);
        
        // Log initialization status
        if (debugMode) {
          console.log('Google Analytics initialized successfully');
          console.log('GA Debug Mode:', debugMode);
          console.log('GA Test Mode:', process.env.NODE_ENV !== 'production');
          
          // Test event to verify initialization
          ReactGA.event({
            category: 'System',
            action: 'GAInitialized',
            label: 'Initialization Test',
            nonInteraction: true
          });
        }
      } else {
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error initializing Google Analytics:', error);
      
      // Try to initialize again after a delay
      setTimeout(() => {
        const success = initializeGA();
        if (success) {
          setIsInitialized(true);
        }
      }, 2000);
    }
  }, []);

  // Track page changes
  useEffect(() => {
    if (!pathname || !isInitialized) return;
    
    // Send pageview with path and search parameters
    const page = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    try {
      // Only send pageview if GA is initialized
      if (window.GA_INITIALIZED) {
        // Use the utility function to track page view
        trackPageView(page, document.title || pathname);
      }
    } catch (error) {
      console.error('Error sending Google Analytics pageview:', error);
    }
  }, [pathname, searchParams, isInitialized]);

  return children;
}