'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';
import { createTileLayer, getDefaultMapView, logMapError, testMapTileAccess } from '../../utils/mapConfig';

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

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
  initialZoom = 10,
  onZoomChange,
  disableZoom = false,
  allowPanning = true,
}) => {
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
          zoomControl: !disableZoom && showControls,
          attributionControl: false,
          scrollWheelZoom: !disableZoom,
          doubleClickZoom: !disableZoom,
          touchZoom: !disableZoom,
          boxZoom: !disableZoom,
          keyboard: !disableZoom,
          dragging: allowPanning,
        });

        // Add tile layer with theme support and error handling
        const isDarkMode = resolvedTheme === 'dark';

        // Test tile accessibility first
        const tilesAccessible = await testMapTileAccess(isDarkMode);
        if (!tilesAccessible) {
          console.warn('Map tiles may not be accessible, but proceeding anyway');
        }

        const tileLayer = createTileLayer(L, isDarkMode);
        tileLayer.addTo(map);

        // Use centralized map view logic
        const mapView = getDefaultMapView(location);
        const zoom = initialZoomRef.current || mapView.zoom;

        map.setView(mapView.center, zoom);

        // Add marker if location exists
        if (hasLocation) {
          const marker = L.marker([location.lat, location.lng]).addTo(map);
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
        logMapError('MapPicker initialization', err, {
          hasLocation: !!location,
          theme: resolvedTheme,
          readOnly,
          height
        });
        setError('Failed to initialize map. Please try refreshing the page.');
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      initializeMap();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, []);

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
        className="absolute inset-0 bg-background"
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