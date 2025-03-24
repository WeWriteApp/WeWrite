"use client";
import React, { useEffect, useState } from "react";
import ReactGA from 'react-ga4';
import { usePathname, useSearchParams } from 'next/navigation';
import { getAnalyticsService } from '../utils/analytics-service';
import { ANALYTICS_EVENTS } from '../constants/analytics-events';

export default function GAProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Google Analytics only once
  useEffect(() => {
    const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    
    if (!GA_TRACKING_ID) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Missing Google Analytics Measurement ID in .env.local');
      }
      return;
    }
    
    try {
      // Check if GA has already been initialized to avoid duplicate initialization
      if (!window.GA_INITIALIZED) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Initializing Google Analytics with ID:', GA_TRACKING_ID);
        }
        
        ReactGA.initialize(GA_TRACKING_ID, {
          gaOptions: {
            debug_mode: process.env.NODE_ENV === 'development'
          },
          testMode: process.env.NODE_ENV !== 'production'
        });
        
        // Mark as initialized
        window.GA_INITIALIZED = true;
        setIsInitialized(true);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Google Analytics initialized successfully');
        }
      } else {
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error initializing Google Analytics:', error);
    }
  }, []);

  // Track page changes
  useEffect(() => {
    if (!isInitialized || !pathname) return;
    
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Get a meaningful page title based on the current route
    let pageTitle = document.title;
    
    // For specific routes, we can set more descriptive titles
    if (pathname === '/') {
      pageTitle = 'WeWrite - Home';
    } else if (pathname.startsWith('/auth/login')) {
      pageTitle = 'WeWrite - Login';
    } else if (pathname.startsWith('/auth/register')) {
      pageTitle = 'WeWrite - Register';
    } else if (pathname.startsWith('/user/')) {
      // For user profile pages
      const username = document.querySelector('h1')?.textContent;
      if (username) {
        pageTitle = `WeWrite - ${username}`;
      } else {
        pageTitle = 'WeWrite - User Profile';
      }
    } else if (pathname.startsWith('/pages/')) {
      // For content pages, try to get a more specific title
      const contentTitle = document.querySelector('h1')?.textContent;
      if (contentTitle) {
        pageTitle = `WeWrite - ${contentTitle}`;
      } else {
        pageTitle = 'WeWrite - Content Page';
      }
    }
    
    // Track with ReactGA (legacy approach)
    ReactGA.send({ 
      hitType: "pageview", 
      page: url,
      title: pageTitle
    });
    
    // Also track with the new analytics service
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackPageView(url, pageTitle);
      
      // Track session start on first page view
      if (!window.sessionStartTracked) {
        analyticsService.trackEvent({
          category: 'Session',
          action: ANALYTICS_EVENTS.SESSION_START,
          page_path: url,
          page_title: pageTitle,
        });
        window.sessionStartTracked = true;
      }
    } catch (error) {
      console.error('Error tracking page view with analytics service:', error);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Page view tracked: ${pageTitle} (${url})`);
    }
  }, [pathname, searchParams, isInitialized]);

  return <>{children}</>;
}