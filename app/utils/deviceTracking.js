/**
 * Utility functions for tracking device and app usage
 */

import { doc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/database";

/**
 * Detect if the app is running as a PWA
 * @returns {boolean} True if running as PWA, false otherwise
 */
export const isPwa = () => {
  // Check if the app is running in standalone mode (PWA)
  if (typeof window !== 'undefined') {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone || // iOS Safari
           document.referrer.includes('android-app://');
  }
  return false;
};

/**
 * Detect device type
 * @returns {string} 'desktop', 'tablet', or 'mobile'
 */
export const getDeviceType = () => {
  if (typeof window !== 'undefined') {
    const userAgent = window.navigator.userAgent;

    // Check for tablets first (some tablets report as both mobile and tablet)
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'tablet';
    }

    // Check for mobile devices
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
      return 'mobile';
    }

    // Default to desktop
    return 'desktop';
  }
  return 'unknown';
};

/**
 * Get the full device context
 * @returns {Object} Device context information
 */
export const getDeviceContext = () => {
  const deviceType = getDeviceType();
  const isPwaApp = isPwa();

  return {
    deviceType,
    isPwa: isPwaApp,
    // For analytics categorization
    category: deviceType === 'desktop' ? 'desktop' : (isPwaApp ? 'mobilePwa' : 'mobileBrowser'),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString()
  };
};

/**
 * Track a user session
 * @param {string} userId - The user ID
 */
export const trackUserSession = async (userId) => {
  if (!userId) return;

  try {
    const deviceContext = getDeviceContext();
    const sessionId = `${userId}_${Date.now()}`;

    // Store session data
    await setDoc(doc(db, "sessions", sessionId), {
      userId,
      deviceType: deviceContext.deviceType,
      isPwa: deviceContext.isPwa,
      category: deviceContext.category,
      userAgent: deviceContext.userAgent,
      startTime: serverTimestamp(),
      lastActive: serverTimestamp()
    });

    // Update device usage counts - first check if the document exists
    try {
      const deviceStatsRef = doc(db, "stats", "deviceUsage");

      // Create the document if it doesn't exist
      await setDoc(deviceStatsRef, {
        [`${deviceContext.category}Count`]: increment(1),
        [`${deviceContext.deviceType}Count`]: increment(1),
        lastUpdated: serverTimestamp(),
        // Initialize other counts to 0 if they don't exist
        desktopCount: increment(0),
        mobileCount: increment(0),
        tabletCount: increment(0),
        mobilePwaCount: increment(0),
        mobileBrowserCount: increment(0)
      }, { merge: true }); // Use merge to only update the specified fields
    } catch (statsError) {
      console.warn("Error updating device stats, but session was created:", statsError);
      // Continue execution since the main session was created
    }

    // Store the session ID in localStorage for later reference
    if (typeof window !== 'undefined') {
      localStorage.setItem('wewrite_session_id', sessionId);
    }

    return sessionId;
  } catch (error) {
    console.error("Error tracking user session:", error);
    return null;
  }
};

/**
 * Track a page view
 * @param {string} pageId - The page ID
 * @param {string} userId - The user ID (optional)
 */
export const trackPageView = async (pageId, userId = null) => {
  if (!pageId) return;

  try {
    const deviceContext = getDeviceContext();
    const viewId = `${pageId}_${Date.now()}`;

    // Store page view data
    await setDoc(doc(db, "pageViews", viewId), {
      pageId,
      userId,
      deviceType: deviceContext.deviceType,
      isPwa: deviceContext.isPwa,
      category: deviceContext.category,
      timestamp: serverTimestamp()
    });

    // Update page view count - check if the page exists first
    try {
      const pageStatsRef = doc(db, "pages", pageId);
      await updateDoc(pageStatsRef, {
        viewCount: increment(1),
        lastViewed: serverTimestamp()
      });
    } catch (pageError) {
      console.warn(`Error updating page stats for ${pageId}:`, pageError);
      // Continue execution to update global stats
    }

    // Update global stats - create the document if it doesn't exist
    try {
      const globalStatsRef = doc(db, "stats", "pageViews");

      // Use setDoc with merge to create the document if it doesn't exist
      await setDoc(globalStatsRef, {
        totalViews: increment(1),
        [`${deviceContext.category}Views`]: increment(1),
        lastUpdated: serverTimestamp(),
        // Initialize other view counts if they don't exist
        desktopViews: increment(0),
        mobileViews: increment(0),
        mobilePwaViews: increment(0),
        mobileBrowserViews: increment(0)
      }, { merge: true });
    } catch (statsError) {
      console.warn("Error updating global page view stats:", statsError);
    }
  } catch (error) {
    console.error("Error tracking page view:", error);
  }
};

/**
 * Initialize tracking when the app loads
 */
export const initializeTracking = () => {
  if (typeof window !== 'undefined') {
    // Register service worker for PWA detection
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('ServiceWorker registration successful');
        }).catch(error => {
          console.error('ServiceWorker registration failed:', error);
        });
      });
    }

    // Track initial page load
    const deviceContext = getDeviceContext();
    console.log('Device context:', deviceContext);

    // We'll track the user session when they log in
  }
};
