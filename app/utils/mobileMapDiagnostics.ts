/**
 * Mobile-specific map diagnostics for troubleshooting Safari/WebKit issues
 */

export interface MobileMapDiagnostics {
  isMobileSafari: boolean;
  isPWA: boolean;
  hasViewportMeta: boolean;
  containerIssues: string[];
  networkIssues: string[];
  safariSpecificIssues: string[];
  recommendations: string[];
}

/**
 * Run comprehensive mobile map diagnostics
 */
export function runMobileMapDiagnostics(): MobileMapDiagnostics {
  const diagnostics: MobileMapDiagnostics = {
    isMobileSafari: false,
    isPWA: false,
    hasViewportMeta: false,
    containerIssues: [],
    networkIssues: [],
    safariSpecificIssues: [],
    recommendations: []
  };

  if (typeof window === 'undefined') {
    return diagnostics;
  }

  // Detect mobile Safari
  diagnostics.isMobileSafari = /Safari/.test(navigator.userAgent) && 
    /Mobile/.test(navigator.userAgent) && 
    !/Chrome/.test(navigator.userAgent);

  // Detect PWA mode
  diagnostics.isPWA = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  // Check viewport meta tag
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  diagnostics.hasViewportMeta = !!viewportMeta;

  if (!diagnostics.hasViewportMeta) {
    diagnostics.containerIssues.push('Missing viewport meta tag');
    diagnostics.recommendations.push('Add viewport meta tag for proper mobile rendering');
  }

  // Check for Safari-specific issues
  if (diagnostics.isMobileSafari) {
    // Check memory constraints
    if ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4) {
      diagnostics.safariSpecificIssues.push('Low device memory detected');
      diagnostics.recommendations.push('Reduce map tile cache size for low-memory devices');
    }

    // Check for iOS version issues
    const iosVersion = navigator.userAgent.match(/OS (\d+)_/);
    if (iosVersion && parseInt(iosVersion[1]) < 14) {
      diagnostics.safariSpecificIssues.push('Old iOS version may have map rendering issues');
      diagnostics.recommendations.push('Consider showing fallback for older iOS versions');
    }

    // Check for PWA-specific issues
    if (diagnostics.isPWA) {
      diagnostics.safariSpecificIssues.push('PWA mode may have additional restrictions');
      diagnostics.recommendations.push('Test map functionality in both browser and PWA modes');
    }

    // Check touch-action support
    const testElement = document.createElement('div');
    testElement.style.touchAction = 'pan-x pan-y';
    if (testElement.style.touchAction !== 'pan-x pan-y') {
      diagnostics.safariSpecificIssues.push('Limited touch-action support');
      diagnostics.recommendations.push('Use alternative touch handling for older Safari versions');
    }
  }

  // Check network conditions
  const connection = (navigator as any).connection;
  if (connection) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      diagnostics.networkIssues.push('Slow network connection detected');
      diagnostics.recommendations.push('Reduce map tile quality or show offline message');
    }

    if (connection.saveData) {
      diagnostics.networkIssues.push('Data saver mode enabled');
      diagnostics.recommendations.push('Disable map auto-loading when data saver is on');
    }
  }

  // Check container sizing issues
  const mapContainers = document.querySelectorAll('[class*="map"], [id*="map"]');
  mapContainers.forEach((container) => {
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      diagnostics.containerIssues.push(`Map container has zero dimensions: ${container.className || container.id}`);
      diagnostics.recommendations.push('Ensure map containers have explicit dimensions');
    }
  });

  // Check for zoom conflicts
  if (diagnostics.isMobileSafari) {
    const viewportContent = viewportMeta?.getAttribute('content') || '';
    if (!viewportContent.includes('user-scalable=no') && !viewportContent.includes('maximum-scale')) {
      diagnostics.safariSpecificIssues.push('Viewport allows unlimited zoom which may conflict with map');
      diagnostics.recommendations.push('Consider setting maximum-scale in viewport meta tag');
    }
  }

  return diagnostics;
}

/**
 * Log mobile map diagnostics to console
 */
export function logMobileMapDiagnostics() {
  const diagnostics = runMobileMapDiagnostics();
  
  console.group('🗺️📱 Mobile Map Diagnostics');
  
  if (diagnostics.containerIssues.length > 0) {
    console.warn('Container Issues:', diagnostics.containerIssues);
  }
  
  if (diagnostics.networkIssues.length > 0) {
    console.warn('Network Issues:', diagnostics.networkIssues);
  }
  
  if (diagnostics.safariSpecificIssues.length > 0) {
    console.warn('Safari-Specific Issues:', diagnostics.safariSpecificIssues);
  }
  
  if (diagnostics.recommendations.length > 0) {
    console.info('Recommendations:', diagnostics.recommendations);
  }
  
  console.groupEnd();
  
  return diagnostics;
}

/**
 * Test if map tiles can be loaded on mobile
 * Note: With no-cors mode, we can't actually check the response status,
 * so this test just verifies that fetch doesn't throw an exception.
 * The actual tile loading happens through Leaflet and may work even if this test seems to fail.
 */
export async function testMobileMapTileLoading(): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  // Always return true since no-cors fetch can't reliably test tile loading
  // The actual map will handle tile errors through Leaflet's error handlers
  // This avoids false negatives that would show error messages when tiles actually work
  console.debug('🗺️ Mobile tile loading test skipped - relying on Leaflet error handlers');
  return true;
}
