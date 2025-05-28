"use client";

/**
 * Polyfill Test Utility
 * 
 * This utility tests if required polyfills are working correctly
 * and provides fallbacks for missing browser features.
 */

/**
 * Test if Intl.Segmenter is available and working
 */
export function testIntlSegmenter() {
  if (typeof window === 'undefined') {
    return { available: false, reason: 'Server-side rendering' };
  }

  try {
    if (!window.Intl || !window.Intl.Segmenter) {
      return { available: false, reason: 'Intl.Segmenter not available' };
    }

    // Test basic functionality
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const segments = Array.from(segmenter.segment('Hello world'));
    
    if (segments.length > 0) {
      return { available: true, segments: segments.length };
    } else {
      return { available: false, reason: 'Segmenter not working correctly' };
    }
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * Test if required browser APIs are available
 */
export function testBrowserAPIs() {
  if (typeof window === 'undefined') {
    return { server: true };
  }

  const tests = {
    requestAnimationFrame: !!window.requestAnimationFrame,
    IntersectionObserver: !!window.IntersectionObserver,
    ResizeObserver: !!window.ResizeObserver,
    MutationObserver: !!window.MutationObserver,
    Promise: !!window.Promise,
    fetch: !!window.fetch,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    history: !!window.history,
    URL: !!window.URL,
    URLSearchParams: !!window.URLSearchParams,
    FormData: !!window.FormData,
    Blob: !!window.Blob,
    File: !!window.File,
    FileReader: !!window.FileReader,
    WebSocket: !!window.WebSocket,
    Worker: !!window.Worker,
    ServiceWorker: !!window.navigator?.serviceWorker,
    PushManager: !!window.PushManager,
    Notification: !!window.Notification,
    geolocation: !!window.navigator?.geolocation,
    clipboard: !!window.navigator?.clipboard,
    share: !!window.navigator?.share,
    userAgent: window.navigator?.userAgent || 'unknown'
  };

  return tests;
}

/**
 * Test if React and related libraries are working
 */
export function testReactAPIs() {
  try {
    const React = require('react');
    const ReactDOM = require('react-dom');
    
    return {
      React: !!React,
      ReactDOM: !!ReactDOM,
      version: React.version || 'unknown',
      createElement: !!React.createElement,
      useState: !!React.useState,
      useEffect: !!React.useEffect,
      useRef: !!React.useRef,
      useCallback: !!React.useCallback,
      useMemo: !!React.useMemo,
      useContext: !!React.useContext
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Run all tests and return a comprehensive report
 */
export function runPolyfillTests() {
  const results = {
    timestamp: new Date().toISOString(),
    intlSegmenter: testIntlSegmenter(),
    browserAPIs: testBrowserAPIs(),
    reactAPIs: testReactAPIs(),
    userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : 'server',
    environment: typeof window !== 'undefined' ? 'client' : 'server'
  };

  console.log('Polyfill Test Results:', results);
  return results;
}

/**
 * Initialize polyfill testing on component mount
 */
export function initPolyfillTesting() {
  if (typeof window === 'undefined') return;

  // Run tests after a short delay to ensure polyfills are loaded
  setTimeout(() => {
    const results = runPolyfillTests();
    
    // Store results in sessionStorage for debugging
    try {
      sessionStorage.setItem('polyfillTestResults', JSON.stringify(results));
    } catch (error) {
      console.warn('Could not store polyfill test results:', error);
    }
  }, 1000);
}
