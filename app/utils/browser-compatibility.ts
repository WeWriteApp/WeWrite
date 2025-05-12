/**
 * Browser compatibility utilities for checking feature support
 */

/**
 * Check if the browser fully supports notifications
 * This checks both the Notification API and Service Worker API
 */
export const checkNotificationSupport = (): {
  isSupported: boolean;
  details: {
    notificationApiSupported: boolean;
    serviceWorkerSupported: boolean;
    secureContext: boolean;
  };
} => {
  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      details: {
        notificationApiSupported: false,
        serviceWorkerSupported: false,
        secureContext: false,
      }
    };
  }

  const notificationApiSupported = 'Notification' in window;
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const secureContext = window.isSecureContext;

  return {
    isSupported: notificationApiSupported && serviceWorkerSupported && secureContext,
    details: {
      notificationApiSupported,
      serviceWorkerSupported,
      secureContext,
    }
  };
};

/**
 * Get browser name and version for debugging purposes
 */
export const getBrowserInfo = (): { name: string; version: string } => {
  if (typeof window === 'undefined' || !window.navigator) {
    return { name: 'unknown', version: 'unknown' };
  }

  const userAgent = navigator.userAgent;
  let browserName = 'Unknown';
  let browserVersion = '';

  // Chrome
  if (userAgent.indexOf('Chrome') > -1) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }
  // Firefox
  else if (userAgent.indexOf('Firefox') > -1) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }
  // Safari
  else if (userAgent.indexOf('Safari') > -1) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }
  // Edge
  else if (userAgent.indexOf('Edg') > -1) {
    browserName = 'Edge';
    const match = userAgent.match(/Edg\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }
  // IE
  else if (userAgent.indexOf('Trident') > -1) {
    browserName = 'Internet Explorer';
    const match = userAgent.match(/rv:(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }

  return { name: browserName, version: browserVersion };
};
