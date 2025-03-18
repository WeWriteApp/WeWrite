"use client";
import React, { useEffect } from "react";
import ReactGA from 'react-ga4';
import { usePathname, useSearchParams } from 'next/navigation';

export default function GAProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize Google Analytics
  useEffect(() => {
    const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    
    if (!GA_TRACKING_ID) {
      console.warn('Missing Google Analytics Measurement ID in .env.local');
      return;
    }
    
    // Initialize with debug mode in development
    ReactGA.initialize(GA_TRACKING_ID, {
      gaOptions: {
        debug_mode: process.env.NODE_ENV === 'development'
      },
      testMode: process.env.NODE_ENV !== 'production'
    });
    
    // Send initial pageview
    ReactGA.send({
      hitType: "pageview",
      page: window.location.pathname + window.location.search
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Analytics initialized with ID:', GA_TRACKING_ID);
    }
  }, []);

  // Track page changes
  useEffect(() => {
    if (!pathname) return;
    
    // Send pageview with path and search parameters
    const page = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    ReactGA.send({
      hitType: "pageview",
      page: page,
      title: document.title || pathname
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('GA pageview:', page);
    }
  }, [pathname, searchParams]);

  return children;
}