"use client";

import React, { useState, useEffect } from 'react';
import ReactGA from 'react-ga4';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { initializeAnalytics, testFirebaseAnalytics } from "../../firebase/config';

/**
 * Utility functions for debugging Google Analytics and Firebase Analytics
 */

/**
 * Send a test event to Google Analytics to verify it's working
 * @returns {boolean} - Whether the event was sent successfully
 */
export const sendTestEvent = () => {
  console.log('🔍 Attempting to send test events...');

  try {
    // Create identical event data for both GA and Firebase
    const eventName = 'test_event';
    const eventData = {
      category: 'Debug',
      action: 'TestEvent',
      label: 'Manual Test',
      value: Date.now(),
      test_id: Date.now().toString(),
      test_source: 'ga_debugger',
      test_timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.pathname : "unknown"
    };

    console.log('📊 Preparing test event with data:', eventData);

    // Send event to Google Analytics
    if (window.GA_INITIALIZED) {
      console.log('📊 Sending test event to Google Analytics...');
      ReactGA.event(eventData);
      console.log('✅ Test event sent to Google Analytics');

      // Also send a page_view event to GA
      const pageViewData = {
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title || 'Test Page',
        test: true
      };

      console.log('📊 Sending page_view event to Google Analytics...');
      ReactGA.send({
        hitType: "pageview",
        ...pageViewData
      });
      console.log('✅ page_view event sent to Google Analytics');
    } else {
      console.warn('⚠️ Google Analytics not initialized');
    }

    // Send event to Firebase Analytics
    try {
      console.log('🔥 Attempting to get Firebase Analytics instance...');
      const analytics = getAnalytics();

      if (analytics) {
        console.log('🔥 Sending test event to Firebase Analytics...');
        logEvent(analytics, eventName, eventData);
        console.log('✅ Test event sent to Firebase Analytics');

        // Also send a page_view event to Firebase
        const pageViewData = {
          page_location: window.location.href,
          page_path: window.location.pathname,
          page_title: document.title || 'Test Page',
          test: true
        };

        console.log('🔥 Sending page_view event to Firebase Analytics...');
        logEvent(analytics, 'page_view', pageViewData);
        console.log('✅ page_view event sent to Firebase Analytics');
      } else {
        console.warn('⚠️ Firebase Analytics not initialized or not available');
      }
    } catch (fbError) {
      console.error('❌ Error sending test event to Firebase Analytics:', fbError);
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending test events:', error);
    return false;
  }
};

/**
 * Check if Google Analytics and Firebase Analytics are properly initialized
 * @returns {Object} - Status object with details about GA initialization
 */
export const checkGAStatus = () => {
  const status = {
    ga: {
      initialized: false,
      measurementId: null,
      error: null
    },
    firebase: {
      initialized: false,
      measurementId: null,
      error: null
    }
  };

  try {
    // Check Google Analytics
    status.ga.initialized = !!window.GA_INITIALIZED;
    status.ga.measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    if (!status.ga.measurementId) {
      status.ga.error = 'Missing GA Measurement ID in environment variables';
    } else if (!status.ga.initialized) {
      status.ga.error = 'GA not initialized yet';
    }

    // Check Firebase Analytics
    try {
      status.firebase.measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

      if (!status.firebase.measurementId) {
        status.firebase.error = 'Missing Firebase Measurement ID';
      } else {
        // Try to get analytics instance
        const analytics = getAnalytics();
        status.firebase.initialized = !!analytics;

        if (!status.firebase.initialized) {
          status.firebase.error = 'Firebase Analytics not initialized';
        }
      }
    } catch (fbError) {
      status.firebase.error = fbError.message;
    }

    console.log('Analytics Status:', status);
    return status;
  } catch (error) {
    status.ga.error = error.message;
    console.error('Error checking analytics status:', error);
    return status;
  }
};

/**
 * Debug component to verify GA is working
 */
export const GADebugger = () => {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Dynamically import DraggableWrapper to avoid SSR issues
  const DraggableWrapper = require('../components/utils/DraggableWrapper').default;

  const [status, setStatus] = useState({
    ga: { initialized: false, measurementId: null, error: null },
    firebase: { initialized: false, measurementId: null, error: null }
  });
  const [events, setEvents] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'ga', 'firebase'

  // Check analytics status on mount
  useEffect(() => {
    const checkStatus = () => {
      const currentStatus = checkGAStatus();
      setStatus(currentStatus);
    };

    checkStatus();

    // Check status every 3 seconds
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  // Monitor GA events
  useEffect(() => {
    if (!window.GA_INITIALIZED) return;

    // Save original methods
    const originalEvent = ReactGA.event;
    const originalSend = ReactGA.send;

    // Override event method
    ReactGA.event = function(data) {
      // Log the event
      const eventData = {
        source: 'ga',
        type: 'event',
        timestamp: new Date(),
        data: JSON.parse(JSON.stringify(data))
      };

      setEvents(prev => [eventData, ...prev.slice(0, 19)]);
      console.log('GA Event:', data);

      // Call original method
      return originalEvent.apply(this, arguments);
    };

    // Override send method
    ReactGA.send = function(data) {
      // Log the send
      const sendData = {
        source: 'ga',
        type: data.hitType || 'unknown',
        timestamp: new Date(),
        data: JSON.parse(JSON.stringify(data))
      };

      setEvents(prev => [sendData, ...prev.slice(0, 19)]);
      console.log('GA Send:', data);

      // Call original method
      return originalSend.apply(this, arguments);
    };

    // Cleanup
    return () => {
      ReactGA.event = originalEvent;
      ReactGA.send = originalSend;
    };
  }, []);

  // Monitor Firebase Analytics events
  useEffect(() => {
    try {
      // Add a console.log interceptor to catch Firebase Analytics events
      const originalConsoleLog = console.log;

      console.log = function(...args) {
        // Check if this is a Firebase Analytics log
        const logString = args.join(' ');
        if (
          (logString.includes('Firebase Analytics') || logString.includes('analytics')) &&
          (logString.includes('event') || logString.includes('pageview'))
        ) {
          // This appears to be a Firebase Analytics log
          try {
            const eventData = {
              source: 'firebase',
              type: logString.includes('pageview') ? 'pageview' : 'event',
              timestamp: new Date(),
              data: { log: args.join(' ') }
            };

            // Try to extract more structured data if possible
            if (args.length > 1 && typeof args[1] === 'object') {
              eventData.data = { ...eventData.data, ...JSON.parse(JSON.stringify(args[1])) };
            }

            setEvents(prev => [eventData, ...prev.slice(0, 19)]);
          } catch (e) {
            // Just continue if we can't parse the event
          }
        }

        // Call original console.log
        return originalConsoleLog.apply(this, args);
      };

      return () => {
        console.log = originalConsoleLog;
      };
    } catch (error) {
      console.error('Error setting up Firebase Analytics monitoring:', error);
    }
  }, []);

  const handleTestEvent = () => {
    sendTestEvent();
  };

  const handleTestFirebaseEvent = async () => {
    const success = await testFirebaseAnalytics();
    if (success) {
      console.log('Firebase Analytics test completed successfully');
    } else {
      console.error('Firebase Analytics test failed');
    }
  };

  const handleCheckStatus = () => {
    const currentStatus = checkGAStatus();
    setStatus(currentStatus);
  };

  // Filter events based on active tab
  const filteredEvents = events.filter(event => {
    if (activeTab === 'all') return true;
    return event.source === activeTab;
  });

  return (
    <DraggableWrapper
      id="ga-debugger"
      initialPosition={{ x: window.innerWidth - 320, y: 20 }}
    >
      <div className="p-3 w-72">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium">Analytics Debugger</div>
          <div className="flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status.ga.initialized || status.firebase.initialized ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></span>
            <span className="text-xs text-muted-foreground">
              {status.ga.initialized || status.firebase.initialized ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </div>

        {(status.ga.error || status.firebase.error) && (
          <div className="text-xs text-amber-500 mb-2 p-1 bg-amber-50 dark:bg-amber-950/30 rounded">
            {status.ga.error && <div>GA: {status.ga.error}</div>}
            {status.firebase.error && <div>Firebase: {status.firebase.error}</div>}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleTestEvent}
            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
          >
            Test All
          </button>
          <button
            onClick={handleTestFirebaseEvent}
            className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs"
          >
            Test Firebase
          </button>
          <button
            onClick={handleCheckStatus}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
          >
            Check Status
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs ml-auto"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showDetails && (
          <div className="mb-3 text-xs">
            <div className="border border-border/40 rounded p-2 bg-muted/20">
              <div className="font-medium mb-1">Google Analytics</div>
              <div><strong>Measurement ID:</strong> {status.ga.measurementId || 'Not set'}</div>
              <div><strong>Initialized:</strong> {status.ga.initialized ? 'Yes' : 'No'}</div>

              <div className="font-medium mt-2 mb-1">Firebase Analytics</div>
              <div><strong>Measurement ID:</strong> {status.firebase.measurementId || 'Not set'}</div>
              <div><strong>Initialized:</strong> {status.firebase.initialized ? 'Yes' : 'No'}</div>

              <div className="font-medium mt-2 mb-1">Environment</div>
              <div><strong>Mode:</strong> {process.env.NODE_ENV}</div>
              <div><strong>Debug Mode:</strong> {process.env.NODE_ENV === 'development' ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        <div className="flex border-b border-border/40 mb-2">
          <button
            className={`px-2 py-1 text-xs ${activeTab === 'all' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`px-2 py-1 text-xs ${activeTab === 'ga' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('ga')}
          >
            GA4
          </button>
          <button
            className={`px-2 py-1 text-xs ${activeTab === 'firebase' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('firebase')}
          >
            Firebase
          </button>
        </div>

        <div className="text-xs text-muted-foreground mb-1">
          Recent events ({filteredEvents.length})
        </div>

        <div className="max-h-60 overflow-y-auto border rounded border-border/40 bg-muted/30">
          {filteredEvents.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              No events captured yet
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredEvents.map((event, index) => (
                <div key={index} className="p-2 text-xs hover:bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      event.type === 'pageview'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {event.source === 'ga' ? 'GA' : 'Firebase'}: {event.type}
                    </span>
                    <span className="text-muted-foreground">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="mt-1 text-[10px] overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DraggableWrapper>
  );
};
