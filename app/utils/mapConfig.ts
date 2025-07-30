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
    // Use Mapbox tiles (more reliable for production)
    const styleId = isDarkMode ? 'dark-v11' : 'streets-v12';
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
      maxZoom: 22,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // 1x1 transparent PNG
    };
  }

  // Fallback to OpenStreetMap-based tiles
  if (isDarkMode) {
    // Use CartoDB dark tiles for dark mode
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };
  } else {
    // Use OpenStreetMap tiles for light mode with fallback
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };
  }
}

/**
 * Create a tile layer with error handling and fallback
 */
export function createTileLayer(L: any, isDarkMode: boolean = false) {
  const config = getMapTileConfig(isDarkMode);
  
  const tileLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    errorTileUrl: config.errorTileUrl,
    // Add retry logic for failed tiles
    retryDelay: 1000,
    retryLimit: 3,
  });

  // Add error handling
  tileLayer.on('tileerror', function(error: any) {
    console.warn('Map tile failed to load:', {
      url: error.tile.src,
      coords: error.coords,
      error: error.error
    });
    
    // Try to reload the tile after a delay
    setTimeout(() => {
      if (error.tile && error.tile.src) {
        error.tile.src = error.tile.src + '?retry=' + Date.now();
      }
    }, 2000);
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
  
  // Default to world view
  return {
    center: [20, 0] as [number, number], // Slightly north to show more land
    zoom: 2
  };
}

/**
 * Enhanced error logging for map issues
 */
export function logMapError(context: string, error: any, additionalInfo?: any) {
  console.error(`Map Error [${context}]:`, {
    error: error.message || error,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    additionalInfo
  });
}

/**
 * Check if map tiles are accessible
 */
export async function testMapTileAccess(isDarkMode: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return true; // Skip on server
  
  const config = getMapTileConfig(isDarkMode);
  const testUrl = config.url
    .replace('{s}', 'a')
    .replace('{z}', '1')
    .replace('{x}', '0')
    .replace('{y}', '0')
    .replace('{r}', '');

  try {
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      mode: 'no-cors' // Avoid CORS issues for testing
    });
    return true; // If we get here, the request didn't fail immediately
  } catch (error) {
    console.warn('Map tile accessibility test failed:', error);
    return false;
  }
}
