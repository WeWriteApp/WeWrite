'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

interface Location {
  lat: number;
  lng: number;
}

interface OpenStreetMapPickerProps {
  location?: Location | null;
  onChange?: (location: Location | null) => void;
  height?: string;
  readOnly?: boolean;
  showControls?: boolean;
  className?: string;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

const OpenStreetMapPicker: React.FC<OpenStreetMapPickerProps> = ({
  location,
  onChange,
  height = '400px',
  readOnly = false,
  showControls = true,
  className = '',
  initialZoom,
  onZoomChange
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Initialize Leaflet and create map
  useEffect(() => {
    const initializeMap = async () => {
      try {
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

        if (!mapRef.current || mapInstanceRef.current) {
          return;
        }

        // Create map instance
        const map = L.map(mapRef.current, {
          zoomControl: false, // We'll add custom zoom control
          attributionControl: false, // Remove attribution control
        });

        // Ensure map container has correct z-index
        if (mapRef.current) {
          mapRef.current.style.zIndex = '1';
        }

        // Add custom zoom control with dark mode styling
        const zoomControl = L.control.zoom({
          position: 'bottomright'
        });
        zoomControl.addTo(map);

        // Apply dark mode styles to zoom control after a short delay
        setTimeout(() => {
          const isDarkMode = resolvedTheme === 'dark';
          const zoomButtons = mapRef.current?.querySelectorAll('.leaflet-control-zoom a');
          if (zoomButtons && isDarkMode) {
            zoomButtons.forEach((button: any) => {
              button.style.backgroundColor = 'hsl(var(--background))';
              button.style.color = 'hsl(var(--foreground))';
              button.style.border = '1px solid hsl(var(--border))';
              button.style.borderRadius = '4px';
            });
          }
        }, 100);

        // Add OpenStreetMap tiles with theme support
        const isDarkMode = resolvedTheme === 'dark';
        const tileUrl = isDarkMode
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
          attribution: '', // Remove attribution from UI
          maxZoom: 19,
        }).addTo(map);

        // Set initial view
        const initialLat = location?.lat || 39.8283; // Default to center of USA
        const initialLng = location?.lng || -98.5795; // Center of continental US
        const zoom = initialZoom || (location ? 15 : 0); // Zoom level 0 shows entire world

        map.setView([initialLat, initialLng], zoom);

        // Listen for zoom changes to save the zoom level
        if (onZoomChange) {
          map.on('zoomend', () => {
            onZoomChange(map.getZoom());
          });
        }

        // Add marker if location exists
        if (location) {
          const marker = L.marker([location.lat, location.lng], {
            draggable: !readOnly
          }).addTo(map);

          if (!readOnly) {
            marker.on('dragend', (e: any) => {
              const newPos = e.target.getLatLng();
              onChange?.({ lat: newPos.lat, lng: newPos.lng });
            });
          }

          markerRef.current = marker;
        }

        // Add click handler for placing/moving marker
        if (!readOnly) {
          map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;

            // Mark that this is no longer the initial load to prevent auto-zoom
            isInitialLoadRef.current = false;

            if (markerRef.current) {
              // Move existing marker
              markerRef.current.setLatLng([lat, lng]);
            } else {
              // Create new marker
              const marker = L.marker([lat, lng], {
                draggable: true
              }).addTo(map);

              marker.on('dragend', (dragEvent: any) => {
                const newPos = dragEvent.target.getLatLng();
                onChange?.({ lat: newPos.lat, lng: newPos.lng });
              });

              markerRef.current = marker;
            }

            onChange?.({ lat, lng });
          });
        }

        mapInstanceRef.current = map;
        setIsLoading(false);

      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map');
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure the container has proper dimensions
    const timer = setTimeout(() => {
      initializeMap();
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Handle theme changes for zoom controls
  useEffect(() => {
    if (!mapInstanceRef.current || !mapRef.current) return;

    const applyZoomControlStyles = () => {
      const isDarkMode = resolvedTheme === 'dark';
      const zoomButtons = mapRef.current?.querySelectorAll('.leaflet-control-zoom a');
      if (zoomButtons) {
        zoomButtons.forEach((button: any) => {
          if (isDarkMode) {
            button.style.backgroundColor = 'hsl(var(--background))';
            button.style.color = 'hsl(var(--foreground))';
            button.style.border = '1px solid hsl(var(--border))';
            button.style.borderRadius = '4px';
          } else {
            // Reset to default styles for light mode
            button.style.backgroundColor = '';
            button.style.color = '';
            button.style.border = '';
            button.style.borderRadius = '';
          }
        });
      }
    };

    applyZoomControlStyles();
  }, [resolvedTheme]);

  // Update marker when location prop changes
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    if (location) {
      if (markerRef.current) {
        // Update existing marker
        markerRef.current.setLatLng([location.lat, location.lng]);
      } else {
        // Create new marker
        const marker = L.marker([location.lat, location.lng], {
          draggable: !readOnly
        }).addTo(mapInstanceRef.current);

        if (!readOnly) {
          marker.on('dragend', (e: any) => {
            const newPos = e.target.getLatLng();
            onChange?.({ lat: newPos.lat, lng: newPos.lng });
          });
        }

        markerRef.current = marker;
      }

      // Only center map on location if it's the initial load or if we're in read-only mode
      // For interactive maps, preserve the current zoom level and don't auto-center
      if (readOnly || isInitialLoadRef.current) {
        const zoom = initialZoom || 15;
        mapInstanceRef.current.setView([location.lat, location.lng], zoom);
        isInitialLoadRef.current = false;
      }
    } else {
      // Remove marker if no location
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    }
  }, [location, readOnly, onChange]);

  // Handle getting user's current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange?.({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your current location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Handle clearing location
  const handleClearLocation = () => {
    onChange?.(null);
  };

  if (error) {
    return (
      <div 
        className={`w-full bg-muted/50 rounded-lg flex items-center justify-center border border-muted/20 ${className}`}
        style={{ height }}
      >
        <div className="text-center space-y-2 p-4">
          <MapPin className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-destructive">Failed to load map</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{
          height,
          minHeight: height === '100%' ? '400px' : '200px',
          zIndex: 1
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center space-y-2 p-4">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && !readOnly && (
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetCurrentLocation}
            className="bg-background/90 backdrop-blur-sm shadow-sm"
            title="Use current location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          
          {location && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearLocation}
              className="bg-background/90 backdrop-blur-sm shadow-sm"
              title="Clear location"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}


    </div>
  );
};

export default OpenStreetMapPicker;
