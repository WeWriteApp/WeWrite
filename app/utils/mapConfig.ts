/**
 * Centralized map configuration for consistent tile providers and error handling
 */

export interface MapTileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  errorTileUrl?: string;
}

/**
 * Get the appropriate tile configuration based on theme and environment
 */
export function getMapTileConfig(isDarkMode: boolean = false): MapTileConfig {
  // Check if we have a Mapbox token for premium tiles
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (mapboxToken && mapboxToken !== 'your-mapbox-token') {
    // Use Mapbox minimal black and white styles for consistency
    const styleId = isDarkMode ? 'dark-v11' : 'light-v11';
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
      maxZoom: 22,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // 1x1 transparent PNG
    };
  }

  // Use consistent black and white map styles
  if (isDarkMode) {
    // Use CartoDB dark matter for dark mode - very dark black and white
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };
  } else {
    // Use CartoDB light matter for light mode - very light black and white
    return {
      url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };
  }
}

/**
 * Create a tile layer with error handling and mobile optimizations
 */
export function createTileLayer(L: any, isDarkMode: boolean = false) {
  const config = getMapTileConfig(isDarkMode);

  // Detect mobile Safari
  const isMobileSafari = typeof navigator !== 'undefined' &&
    /Safari/.test(navigator.userAgent) &&
    /Mobile/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent);

  const tileLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    errorTileUrl: config.errorTileUrl,
    // Mobile Safari optimizations
    crossOrigin: isMobileSafari ? 'anonymous' : null,
    // Reduce concurrent tile requests on mobile
    maxNativeZoom: isMobileSafari ? 18 : config.maxZoom,
    // Better caching on mobile
    updateWhenIdle: isMobileSafari,
    updateWhenZooming: !isMobileSafari,
    keepBuffer: isMobileSafari ? 2 : 1,
  });

  // Add basic error handling
  tileLayer.on('tileerror', function(error: any) {
    console.warn('Map tile failed to load:', {
      url: error.tile?.src,
      coords: error.coords,
      error: error.error
    });
  });

  tileLayer.on('tileload', function() {
    // Tiles are loading successfully
    console.debug('Map tiles loading successfully');
  });

  return tileLayer;
}

/**
 * Get default map center and zoom based on location availability
 */
export function getDefaultMapView(location?: { lat: number; lng: number; zoom?: number }) {
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    return {
      center: [location.lat, location.lng] as [number, number],
      zoom: location.zoom || 15
    };
  }

  // Default to world view centered on US Central timezone (Kansas/Missouri area)
  return {
    center: [39, -95] as [number, number],
    zoom: 1
  };
}



/**
 * Check if map tiles are accessible and log detailed diagnostics
 */
export async function testMapTileAccess(isDarkMode: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return true; // Skip on server

  const config = getMapTileConfig(isDarkMode);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  console.log('🗺️ Map Diagnostics:', {
    isDarkMode,
    hasMapboxToken: !!mapboxToken,
    mapboxTokenPrefix: mapboxToken ? mapboxToken.substring(0, 10) + '...' : 'none',
    tileUrl: config.url,
    attribution: config.attribution
  });

  // Test both Mapbox and fallback URLs
  const testUrls = [];

  // If we have Mapbox token, test Mapbox first
  if (mapboxToken && mapboxToken !== 'your-mapbox-token') {
    const styleId = isDarkMode ? 'dark-v11' : 'light-v11';
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/1/0/0?access_token=${mapboxToken}`;
    testUrls.push({ name: 'Mapbox', url: mapboxUrl });
  }

  // Test CartoDB fallback
  const cartoUrl = isDarkMode
    ? 'https://a.basemaps.cartocdn.com/dark_nolabels/1/0/0.png'
    : 'https://a.basemaps.cartocdn.com/light_nolabels/1/0/0.png';
  testUrls.push({ name: 'CartoDB', url: cartoUrl });

  for (const { name, url } of testUrls) {
    try {
      console.log(`🧪 Testing ${name} tiles:`, url);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors'
      });

      console.log(`✅ ${name} tiles accessible`);
      return true;
    } catch (error) {
      console.warn(`❌ ${name} tile test failed:`, {
        url,
        error: error.message,
        stack: error.stack
      });
    }
  }

  console.error('🚨 All map tile services failed');
  return false;
}

/**
 * Enhanced error logging for map issues with mobile detection
 */
export function logMapError(context: string, error: any, additionalInfo?: any) {
  const isMobileSafari = typeof navigator !== 'undefined' &&
    /Safari/.test(navigator.userAgent) &&
    /Mobile/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent);

  const errorDetails = {
    context,
    timestamp: new Date().toISOString(),
    error: {
      message: error?.message || 'Unknown error',
      name: error?.name,
      stack: error?.stack
    },
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 'present' : 'missing',
      isMobileSafari,
      isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
      viewport: typeof window !== 'undefined' ? {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      } : null,
      connection: typeof navigator !== 'undefined' && (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink
      } : null
    },
    additionalInfo
  };

  console.error('🗺️ Map Error:', errorDetails);

  // In production, you might want to send this to your logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to LogRocket, Sentry, or your logging service
    // logToService('map-error', errorDetails);
  }
}
