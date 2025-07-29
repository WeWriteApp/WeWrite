'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

// Removed complex calculateContextualZoom function - not needed

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
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
}

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
}) => {
  console.log('🗺️ MapPicker: Component rendered with props', {
    hasLocation: !!location,
    readOnly,
    hasOnChange: !!onChange,
    initialZoom,
    disableZoom,
    allowPanning
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Store initial zoom in a ref so it doesn't cause re-renders
  const initialZoomRef = useRef(initialZoom);
  // Track if map has been initialized to prevent reinitialization
  const mapInitializedRef = useRef(false);
  // Store current props in refs so they're always up to date
  const readOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);

  // Update refs when props change
  useEffect(() => {
    readOnlyRef.current = readOnly;
    onChangeRef.current = onChange;
  }, [readOnly, onChange]);

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

        if (!mapRef.current) {
          return;
        }
        // Create map instance
        const map = L.map(mapRef.current, {
          zoomControl: !disableZoom && showControls, // Only show zoom controls if both enabled AND showControls is true
          attributionControl: false,
          scrollWheelZoom: !disableZoom,
          doubleClickZoom: !disableZoom,
          touchZoom: !disableZoom,
          boxZoom: !disableZoom,
          keyboard: !disableZoom,
          dragging: allowPanning,
        });

        // Add tile layer with theme support
        const isDarkMode = resolvedTheme === 'dark';
        const tileUrl = isDarkMode
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 19,
        }).addTo(map);

        // Simple logic: use location if available, otherwise default view
        const hasLocation = location && typeof location.lat === 'number' && typeof location.lng === 'number';

        let centerLat, centerLng, zoom;

        if (hasLocation) {
          // Use the location's coordinates and zoom
          centerLat = location.lat;
          centerLng = location.lng;
          zoom = initialZoomRef.current || location.zoom || 15;
        } else {
          // Default to world view - extremely zoomed out
          centerLat = 0.0;   // Equator for true world center
          centerLng = 0.0;   // Prime meridian for world center
          zoom = initialZoomRef.current || 1; // Try zoom 1 first, then we'll force it lower
        }

        console.log('🗺️ MapPicker: Setting initial view', { centerLat, centerLng, zoom, hasLocation });
        map.setView([centerLat, centerLng], zoom);

        // Force extremely zoomed out view if no location
        if (!hasLocation) {
          console.log('🗺️ MapPicker: Forcing world view with setZoom(1)');
          map.setZoom(1);
        }

        // Add marker if location exists
        if (hasLocation) {
          const marker = L.marker([location.lat, location.lng]).addTo(map);
          markerRef.current = marker;

          // Make marker draggable if not read-only
          if (!readOnlyRef.current && onChangeRef.current) {
            marker.dragging.enable();
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              let normalizedLng = pos.lng;
              while (normalizedLng > 180) normalizedLng -= 360;
              while (normalizedLng < -180) normalizedLng += 360;

              onChangeRef.current?.({
                lat: pos.lat,
                lng: normalizedLng,
                zoom: map.getZoom()
              });
            });
          }
        }

        // Add click handler for placing/moving marker
        console.log('🗺️ MapPicker: About to set up click handler', {
          readOnly: readOnlyRef.current,
          hasOnChange: !!onChangeRef.current,
          shouldSetupHandler: !readOnlyRef.current && !!onChangeRef.current
        });

        if (!readOnlyRef.current && onChangeRef.current) {
          console.log('🗺️ MapPicker: Setting up click handler NOW');
          map.on('click', (e: any) => {
            console.log('🗺️ MapPicker: *** MAP CLICKED ***', e.latlng);
            let { lat, lng } = e.latlng;

            // Normalize longitude to handle wrap-around
            while (lng > 180) lng -= 360;
            while (lng < -180) lng += 360;

            // Remove existing marker
            if (markerRef.current) {
              map.removeLayer(markerRef.current);
            }

            // Add new marker
            const marker = L.marker([lat, lng]).addTo(map);
            markerRef.current = marker;

            // Make marker draggable
            marker.dragging.enable();
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              let normalizedLng = pos.lng;
              while (normalizedLng > 180) normalizedLng -= 360;
              while (normalizedLng < -180) normalizedLng += 360;

              onChangeRef.current?.({
                lat: pos.lat,
                lng: normalizedLng,
                zoom: map.getZoom()
              });
            });

            // Call onChange
            console.log('🗺️ MapPicker: Calling onChange with:', { lat, lng, zoom: map.getZoom() });
            onChangeRef.current?.({
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

        // DEBUGGING: Add a simple test click handler that always works
        map.on('click', (e: any) => {
          console.log('🗺️ MapPicker: *** SIMPLE CLICK HANDLER FIRED ***', e.latlng);
        });

        mapInstanceRef.current = map;
        mapInitializedRef.current = true; // Mark as initialized
        setIsLoading(false);

        console.log('🗺️ MapPicker: Map initialization complete', {
          readOnly: readOnlyRef.current,
          hasOnChange: !!onChangeRef.current,
          mapZoom: map.getZoom(),
          mapCenter: map.getCenter()
        });

      } catch (err: any) {
        setError('Failed to initialize map. Please try refreshing the page.');
        setIsLoading(false);
      }
    };

    const timer = setTimeout(initializeMap, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        mapInitializedRef.current = false; // Reset initialization flag
      }
    };
  }, []); // Empty dependency array - only initialize once, never reinitialize

  // Handle location changes - only update marker, not map view
  useEffect(() => {
    if (!mapInstanceRef.current || !location) return;

    const map = mapInstanceRef.current;

    // Update marker position
    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      const marker = L.marker([location.lat, location.lng]).addTo(map);
      markerRef.current = marker;

      if (!readOnlyRef.current && onChangeRef.current) {
        marker.dragging.enable();
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          let normalizedLng = pos.lng;
          while (normalizedLng > 180) normalizedLng -= 360;
          while (normalizedLng < -180) normalizedLng += 360;

          onChangeRef.current?.({
            lat: pos.lat,
            lng: normalizedLng,
            zoom: map.getZoom()
          });
        });
      }
    }

    // Don't call setView here - let the initial view setting handle centering
  }, [location, readOnly, onChange]);

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

  if (error) {
    return (
      <div className={`relative ${className}`} style={{ height }}>
        <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-2 p-4">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
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
      {/* Map container */}
      <div
        ref={mapRef}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center" style={{ zIndex: 2 }}>
          <div className="text-center space-y-2">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
              <Crosshair className="h-4 w-4" />
            </Button>
          )}
          {location && onChange && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearLocation}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MapPicker;
