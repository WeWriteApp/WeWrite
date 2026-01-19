'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';
import { createTileLayer, getDefaultMapView, logMapError } from '../../utils/mapConfig';
import { logMobileMapDiagnostics, testMobileMapTileLoading } from '../../utils/mobileMapDiagnostics';

// Import Leaflet CSS dynamically on client side only
if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
}

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

// Marker data for displaying multiple locations
export interface MapMarker {
  id: string;
  location: Location;
  title?: string;
  color?: string; // hex color for the marker
  isCurrentPage?: boolean; // if true, uses accent color
}

interface MapPickerProps {
  location?: Location | null;
  onChange?: (location: Location | null) => void;
  height?: string;
  readOnly?: boolean;
  showControls?: boolean;
  className?: string;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
  disableZoom?: boolean;
  allowPanning?: boolean;
  originalLocation?: Location | null;
  accentColor?: string;
  /** Additional markers to display (e.g., linked pages) */
  markers?: MapMarker[];
  /** Callback when a marker is clicked */
  onMarkerClick?: (marker: MapMarker) => void;
}

// Helper function to create a custom colored marker icon
const createColoredMarkerIcon = (L: any, color: string, isGhost: boolean = false): any => {
  const opacity = isGhost ? 0.5 : 1;
  const circleFill = isGhost ? '#888' : '#fff';

  // Create SVG as a data URL for better browser compatibility
  // No stroke/border - fill only. viewBox adjusted to prevent clipping
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 38" width="26" height="38"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" fill-opacity="${opacity}"/><circle cx="12" cy="12" r="5" fill="${circleFill}" fill-opacity="${opacity}"/></svg>`;

  const encodedSvg = encodeURIComponent(svg);
  const dataUrl = `data:image/svg+xml,${encodedSvg}`;

  return L.icon({
    iconUrl: dataUrl,
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -38]
  });
};

// Get accent color from CSS variable
const getAccentColorFromCSS = (): string => {
  if (typeof window === 'undefined') return '#2563EB';
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--accent-color').trim() || '#2563EB';
};

const MapPicker: React.FC<MapPickerProps> = ({
  location,
  onChange,
  height = '400px',
  readOnly = false,
  showControls = true,
  className = '',
  initialZoom,
  onZoomChange,
  disableZoom = false,
  allowPanning = true,
  originalLocation,
  accentColor,
  markers = [],
  onMarkerClick,
}) => {

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const originalMarkerRef = useRef<any>(null);
  const additionalMarkersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Get the actual accent color to use
  const effectiveAccentColor = accentColor || getAccentColorFromCSS();

  // Store initial zoom in a ref so it doesn't cause re-renders
  const initialZoomRef = useRef(initialZoom);
  // Track if map has been initialized to prevent reinitialization
  const mapInitializedRef = useRef(false);

  // Initialize map
  useEffect(() => {
    const initializeMap = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        // Prevent reinitialization if map already exists
        if (mapInitializedRef.current || mapInstanceRef.current) {
          return;
        }

        // Check if the map container exists and is visible
        if (!mapRef.current) {
          setIsLoading(false);
          return;
        }

        // Check if the container is actually visible (has dimensions)
        const containerRect = mapRef.current.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
          // On mobile Safari, container might not have dimensions immediately
          // Wait a bit and try again
          if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent)) {
            console.log('🍎 Mobile Safari detected, waiting for container dimensions...');
            setTimeout(() => {
              const retryRect = mapRef.current?.getBoundingClientRect();
              if (retryRect && (retryRect.width === 0 || retryRect.height === 0)) {
                console.warn('🍎 Mobile Safari: Container still has no dimensions after retry');
                setError('Map container sizing issue on mobile. Please try refreshing.');
                setIsLoading(false);
                return;
              }
              // Retry initialization
              initializeMap();
            }, 500);
            return;
          }
          setIsLoading(false);
          return;
        }

        // Dynamic import to avoid SSR issues
        const leaflet = await import('leaflet');
        L = leaflet.default;

        // Fix for default markers in webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Detect mobile Safari for specific configurations
        const isMobileSafari = typeof navigator !== 'undefined' &&
          /Safari/.test(navigator.userAgent) &&
          /Mobile/.test(navigator.userAgent) &&
          !/Chrome/.test(navigator.userAgent);

        // Create map instance with mobile Safari optimizations
        const map = L.map(mapRef.current, {
          zoomControl: !disableZoom && showControls,
          attributionControl: false,
          scrollWheelZoom: !disableZoom,
          doubleClickZoom: !disableZoom,
          touchZoom: !disableZoom,
          boxZoom: !disableZoom,
          keyboard: !disableZoom,
          dragging: allowPanning,
          // Mobile Safari specific optimizations
          tap: isMobileSafari,
          tapTolerance: isMobileSafari ? 20 : 15,
          zoomSnap: isMobileSafari ? 0.5 : 1,
          zoomDelta: isMobileSafari ? 0.5 : 1,
          wheelPxPerZoomLevel: isMobileSafari ? 120 : 60,
          // Prevent zoom conflicts with Safari's native zoom
          bounceAtZoomLimits: !isMobileSafari,
        });

        console.log('🗺️ Map initialized with mobile Safari optimizations:', {
          isMobileSafari,
          containerDimensions: {
            width: containerRect.width,
            height: containerRect.height
          }
        });

        // Run mobile diagnostics if on mobile Safari
        if (isMobileSafari) {
          logMobileMapDiagnostics();

          // Test tile loading capability
          testMobileMapTileLoading().then(canLoadTiles => {
            if (!canLoadTiles) {
              console.error('🍎 Mobile Safari: Tile loading test failed');
              setError('Map tiles cannot be loaded on this device. Please check your network connection.');
            }
          });
        }

        // Add tile layer with theme support and mobile-specific error handling
        const isDarkMode = resolvedTheme === 'dark';

        const tileLayer = createTileLayer(L, isDarkMode);

        // Mobile Safari specific tile loading optimizations
        if (isMobileSafari) {
          tileLayer.options.updateWhenIdle = true;
          tileLayer.options.keepBuffer = 2;
          tileLayer.options.updateWhenZooming = false;
        }

        // Enhanced error handling for mobile with success rate tracking
        let tileErrorCount = 0;
        let tileSuccessCount = 0;
        let hasShownError = false;

        tileLayer.on('tileerror', function(error: any) {
          tileErrorCount++;
          console.warn('🗺️ Tile error:', {
            url: error.tile?.src,
            coords: error.coords,
            error: error.error,
            isMobileSafari,
            totalErrors: tileErrorCount,
            totalSuccess: tileSuccessCount
          });

          // Only show error if:
          // 1. On mobile Safari AND
          // 2. Error count is high (>15) AND
          // 3. Error rate is > 50% (more failures than successes) AND
          // 4. Haven't already shown this error
          const totalAttempts = tileErrorCount + tileSuccessCount;
          const errorRate = totalAttempts > 0 ? tileErrorCount / totalAttempts : 0;

          if (isMobileSafari && tileErrorCount > 15 && errorRate > 0.5 && !hasShownError) {
            hasShownError = true;
            setError('Map tiles are having trouble loading on mobile. Please check your connection and try refreshing.');
          }
        });

        tileLayer.on('tileload', function() {
          tileSuccessCount++;
          // If tiles start loading successfully after errors, clear the error
          if (hasShownError && tileSuccessCount > 10) {
            const totalAttempts = tileErrorCount + tileSuccessCount;
            const successRate = tileSuccessCount / totalAttempts;
            // If success rate improves to > 70%, clear the error
            if (successRate > 0.7) {
              hasShownError = false;
              setError(null);
              console.log('🗺️ Map tiles recovered, clearing error');
            }
          }
        });

        tileLayer.addTo(map);

        // Use centralized map view logic
        const mapView = getDefaultMapView(location);
        // Use initialZoom if provided, otherwise use mapView.zoom from config
        const zoom = initialZoomRef.current !== undefined ? initialZoomRef.current : mapView.zoom;

        map.setView(mapView.center, zoom);

        // Get current accent color for markers
        const currentAccentColor = accentColor || getAccentColorFromCSS();

        // Add original location marker (grey/ghost) if provided and different from current location
        if (originalLocation) {
          const isLocationDifferent = !location ||
            originalLocation.lat !== location.lat ||
            originalLocation.lng !== location.lng;

          if (isLocationDifferent) {
            const ghostIcon = createColoredMarkerIcon(L, '#888888', true);
            const originalMarker = L.marker([originalLocation.lat, originalLocation.lng], {
              icon: ghostIcon,
              interactive: false // Not clickable/draggable
            }).addTo(map);
            originalMarkerRef.current = originalMarker;
          }
        }

        // Add marker if location exists
        if (location) {
          // Use accent-colored marker
          const accentIcon = createColoredMarkerIcon(L, currentAccentColor, false);
          const marker = L.marker([location.lat, location.lng], { icon: accentIcon }).addTo(map);
          markerRef.current = marker;

          // Make marker draggable if not read-only
          if (!readOnly && onChange) {
            marker.dragging.enable();
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              let normalizedLng = pos.lng;
              while (normalizedLng > 180) normalizedLng -= 360;
              while (normalizedLng < -180) normalizedLng += 360;

              onChange?.({
                lat: pos.lat,
                lng: normalizedLng,
                zoom: map.getZoom()
              });
            });
          }
        }

        // Add additional markers (e.g., linked pages)
        if (markers && markers.length > 0) {
          // Clear any existing additional markers
          additionalMarkersRef.current.forEach(m => map.removeLayer(m));
          additionalMarkersRef.current = [];

          // Neutral gray color for linked pages
          const linkedPageColor = '#6B7280'; // text-gray-500

          markers.forEach(markerData => {
            const markerColor = markerData.color || linkedPageColor;
            const icon = createColoredMarkerIcon(L, markerColor, false);
            const additionalMarker = L.marker(
              [markerData.location.lat, markerData.location.lng],
              { icon, interactive: !!onMarkerClick }
            ).addTo(map);

            // Add popup with title if available
            if (markerData.title) {
              additionalMarker.bindPopup(markerData.title);
            }

            // Add click handler
            if (onMarkerClick) {
              additionalMarker.on('click', () => {
                onMarkerClick(markerData);
              });
            }

            additionalMarkersRef.current.push(additionalMarker);
          });

          // Fit bounds to show all markers if we have multiple points
          const allPoints: [number, number][] = [];
          if (location) {
            allPoints.push([location.lat, location.lng]);
          }
          markers.forEach(m => {
            allPoints.push([m.location.lat, m.location.lng]);
          });

          if (allPoints.length > 1) {
            const bounds = L.latLngBounds(allPoints);
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
          }
        }

        // Add click handler for placing/moving marker
        if (!readOnly && onChange) {
          map.on('click', (e: any) => {
            let { lat, lng } = e.latlng;

            // Normalize longitude to handle wrap-around
            while (lng > 180) lng -= 360;
            while (lng < -180) lng += 360;

            // Remove existing marker
            if (markerRef.current) {
              map.removeLayer(markerRef.current);
            }

            // Add new marker with accent color
            const clickAccentColor = accentColor || getAccentColorFromCSS();
            const accentIcon = createColoredMarkerIcon(L, clickAccentColor, false);
            const marker = L.marker([lat, lng], { icon: accentIcon }).addTo(map);
            markerRef.current = marker;

            // If there's an original location and we just placed the first marker, show the ghost
            if (originalLocation && !originalMarkerRef.current) {
              const ghostIcon = createColoredMarkerIcon(L, '#888888', true);
              const originalMarker = L.marker([originalLocation.lat, originalLocation.lng], {
                icon: ghostIcon,
                interactive: false
              }).addTo(map);
              originalMarkerRef.current = originalMarker;
            }

            // Make marker draggable
            marker.dragging.enable();
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              let normalizedLng = pos.lng;
              while (normalizedLng > 180) normalizedLng -= 360;
              while (normalizedLng < -180) normalizedLng += 360;

              onChange?.({
                lat: pos.lat,
                lng: normalizedLng,
                zoom: map.getZoom()
              });
            });

            // Call onChange
            onChange?.({
              lat,
              lng,
              zoom: map.getZoom()
            });
          });
        }

        // Handle zoom changes
        if (onZoomChange) {
          map.on('zoomend', () => {
            onZoomChange(map.getZoom());
          });
        }

        mapInstanceRef.current = map;
        mapInitializedRef.current = true;
        setIsLoading(false);

      } catch (err: any) {
        console.error('🗺️ MapPicker: Raw initialization error:', err);
        console.error('🗺️ MapPicker: Error type:', typeof err);
        console.error('🗺️ MapPicker: Error constructor:', err?.constructor?.name);
        console.error('🗺️ MapPicker: Error message:', err?.message);
        console.error('🗺️ MapPicker: Error stack:', err?.stack);

        logMapError('MapPicker initialization', err, {
          hasLocation: !!location,
          theme: resolvedTheme,
          readOnly,
          height,
          containerExists: !!mapRef.current,
          containerDimensions: mapRef.current ? {
            width: mapRef.current.getBoundingClientRect().width,
            height: mapRef.current.getBoundingClientRect().height
          } : null,
          errorType: typeof err,
          errorConstructor: err?.constructor?.name,
          errorMessage: err?.message
        });
        setError('Failed to initialize map. Please try refreshing the page.');
        setIsLoading(false);
      }
    };

    // Mobile Safari needs more time for proper rendering
    const isMobileSafari = typeof navigator !== 'undefined' &&
      /Safari/.test(navigator.userAgent) &&
      /Mobile/.test(navigator.userAgent) &&
      !/Chrome/.test(navigator.userAgent);

    const delay = isMobileSafari ? 300 : 100;

    const timer = setTimeout(() => {
      initializeMap();
    }, delay);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        originalMarkerRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, []);

  // Handle location changes - only update marker, not map view
  useEffect(() => {
    if (!mapInstanceRef.current || !location || !L) return;

    const map = mapInstanceRef.current;

    // Update marker position
    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      // Create new accent-colored marker
      const currentAccentColor = accentColor || getAccentColorFromCSS();
      const accentIcon = createColoredMarkerIcon(L, currentAccentColor, false);
      const marker = L.marker([location.lat, location.lng], { icon: accentIcon }).addTo(map);
      markerRef.current = marker;

      if (!readOnly && onChange) {
        marker.dragging.enable();
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          let normalizedLng = pos.lng;
          while (normalizedLng > 180) normalizedLng -= 360;
          while (normalizedLng < -180) normalizedLng += 360;

          onChange?.({
            lat: pos.lat,
            lng: normalizedLng,
            zoom: map.getZoom()
          });
        });
      }
    }
  }, [location, readOnly, onChange, accentColor]);

  // Handle markers changes - update linked page markers
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    const map = mapInstanceRef.current;

    // Clear existing additional markers
    additionalMarkersRef.current.forEach(m => map.removeLayer(m));
    additionalMarkersRef.current = [];

    // Add new markers
    if (markers && markers.length > 0) {
      const linkedPageColor = '#6B7280'; // text-gray-500

      markers.forEach(markerData => {
        const markerColor = markerData.color || linkedPageColor;
        const icon = createColoredMarkerIcon(L, markerColor, false);
        const additionalMarker = L.marker(
          [markerData.location.lat, markerData.location.lng],
          { icon, interactive: !!onMarkerClick }
        ).addTo(map);

        if (markerData.title) {
          additionalMarker.bindPopup(markerData.title);
        }

        if (onMarkerClick) {
          additionalMarker.on('click', () => {
            onMarkerClick(markerData);
          });
        }

        additionalMarkersRef.current.push(additionalMarker);
      });

      // Fit bounds to show all markers
      const allPoints: [number, number][] = [];
      if (location) {
        allPoints.push([location.lat, location.lng]);
      }
      markers.forEach(m => {
        allPoints.push([m.location.lat, m.location.lng]);
      });

      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      }
    }
  }, [markers, location, onMarkerClick]);

  const handleCenterOnLocation = () => {
    if (location && mapInstanceRef.current) {
      mapInstanceRef.current.setView([location.lat, location.lng], 15);
    }
  };

  const handleClearLocation = () => {
    if (onChange) {
      onChange(null);
    }
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  try {
    if (error) {
      return (
        <div className={`relative ${className}`} style={{ height }}>
          <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2 p-4">
              <Icon name="MapPin" size={32} className="mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative ${className} ${!readOnly ? 'cursor-crosshair' : ''}`}
        style={{ height }}
      >
        {/* Map container with mobile Safari optimizations */}
        <div
          ref={mapRef}
          className="absolute inset-0 bg-background"
          style={{
            zIndex: 1,
            // Prevent mobile Safari zoom conflicts
            touchAction: 'pan-x pan-y',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none'
          }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center" style={{ zIndex: 2 }}>
            <div className="text-center space-y-2">
              <Icon name="Loader" size={32} className="mx-auto" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}

        {/* Controls */}
        {showControls && !readOnly && (
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {location && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCenterOnLocation}
                className="h-8 w-8 p-0"
              >
                <Icon name="Crosshair" size={16} />
              </Button>
            )}
            {location && onChange && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleClearLocation}
                className="h-8 w-8 p-0"
              >
                <Icon name="RotateCcw" size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  } catch (renderError: any) {
    console.error('🗺️ MapPicker: Render error:', renderError);
    logMapError('MapPicker render', renderError, {
      hasLocation: !!location,
      location,
      height,
      readOnly,
      showControls,
      className
    });

    return (
      <div className={`relative ${className}`} style={{ height }}>
        <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-2 p-4">
            <Icon name="MapPin" size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Map render error</p>
          </div>
        </div>
      </div>
    );
  }
};

export default MapPicker;