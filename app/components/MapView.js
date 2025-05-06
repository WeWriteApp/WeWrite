"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Map, Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Maximize2, MapPin, Search, Locate } from 'lucide-react';
import { useTheme } from 'next-themes';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Check if Mapbox token is available
const isMapboxTokenAvailable = !!MAPBOX_TOKEN;

/**
 * MapView Component
 *
 * Displays a map with a marker at the specified location.
 * Allows expanding to a full-screen view.
 *
 * @param {Object} props
 * @param {Object} props.location - The location object with lat and lng properties
 * @param {boolean} props.readOnly - Whether the map is read-only (no marker dragging)
 * @param {Function} props.onChange - Callback when the location changes (only used when not readOnly)
 * @param {string} props.height - Height of the map container
 */
const MapView = ({
  location,
  readOnly = true,
  onChange = () => {},
  height = '200px',
  expandable = true,
  showInMetadata = false
}) => {
  const { theme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const mapRef = useRef(null);
  const geocoderContainerRef = useRef(null);

  const [viewState, setViewState] = useState({
    latitude: location?.lat || 40.7128,
    longitude: location?.lng || -74.0060,
    zoom: location ? 13 : 2
  });

  const [marker, setMarker] = useState({
    latitude: location?.lat || null,
    longitude: location?.lng || null
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  // Update marker when location prop changes
  useEffect(() => {
    if (location) {
      setMarker({
        latitude: location.lat,
        longitude: location.lng
      });

      // Only update the center, don't change the zoom level
      setViewState(prev => ({
        ...prev,
        latitude: location.lat,
        longitude: location.lng
      }));
    }
  }, [location]);

  // Initialize geocoder when map is loaded
  useEffect(() => {
    if (mapRef.current && isMapLoaded && !readOnly) {
      const geocoder = new MapboxGeocoder({
        accessToken: MAPBOX_TOKEN,
        mapboxgl: mapRef.current.getMap().constructor,
        marker: false,
        placeholder: 'Search for a location',
        proximity: {
          longitude: viewState.longitude,
          latitude: viewState.latitude
        }
      });

      // Add geocoder to the map
      if (geocoderContainerRef.current) {
        geocoderContainerRef.current.innerHTML = '';
        geocoderContainerRef.current.appendChild(geocoder.onAdd(mapRef.current.getMap()));
      }

      // Handle result selection
      geocoder.on('result', (e) => {
        const { result } = e;
        const newLocation = {
          lat: result.center[1],
          lng: result.center[0]
        };

        setMarker({
          latitude: newLocation.lat,
          longitude: newLocation.lng
        });

        // Update view state without changing zoom
        setViewState(prev => ({
          ...prev,
          latitude: newLocation.lat,
          longitude: newLocation.lng
        }));

        onChange(newLocation);
      });

      return () => {
        geocoder.onRemove();
      };
    }
  }, [isMapLoaded, readOnly, onChange, viewState.latitude, viewState.longitude]);

  // Handle getting user's current location
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          setMarker({
            latitude: newLocation.lat,
            longitude: newLocation.lng
          });

          // Update view state without changing zoom
          setViewState(prev => ({
            ...prev,
            latitude: newLocation.lat,
            longitude: newLocation.lng
          }));

          if (!readOnly) {
            onChange(newLocation);
          }

          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting current location:', error);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  };

  // Handle marker drag end
  const onMarkerDragEnd = (event) => {
    if (readOnly) return;

    const { lngLat } = event;
    setMarker({
      latitude: lngLat.lat,
      longitude: lngLat.lng
    });

    onChange({
      lat: lngLat.lat,
      lng: lngLat.lng
    });
  };

  // Handle map click to add/move marker
  const onMapClick = (event) => {
    if (readOnly) return;

    const { lngLat } = event;
    setMarker({
      latitude: lngLat.lat,
      longitude: lngLat.lng
    });

    onChange({
      lat: lngLat.lat,
      lng: lngLat.lng
    });
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const renderMap = (expanded = false) => (
    <div style={{ height: expanded ? '70vh' : height, width: '100%', position: 'relative' }} className="rounded-lg overflow-hidden">
      {!isMapboxTokenAvailable && (
        <div className={`flex items-center justify-center h-full w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="text-destructive text-center p-4">
            <p>Mapbox token is missing.</p>
            <p className="text-sm text-muted-foreground mt-2">Please add NEXT_PUBLIC_MAPBOX_TOKEN to your environment variables.</p>
          </div>
        </div>
      )}

      {isMapboxTokenAvailable && !isMapLoaded && !mapError && (
        <div className={`flex items-center justify-center h-full w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="animate-pulse text-muted-foreground">Loading map...</div>
        </div>
      )}

      {isMapboxTokenAvailable && mapError && (
        <div className={`flex items-center justify-center h-full w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="text-destructive">Error loading map: {mapError}</div>
        </div>
      )}

      {/* Search box container - only shown in edit mode */}
      {!readOnly && (
        <div
          ref={geocoderContainerRef}
          className="absolute top-2 left-2 z-10 w-[calc(100%-80px)] max-w-[300px]"
        />
      )}

      {isMapboxTokenAvailable && (
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle={isDarkMode
            ? "mapbox://styles/mapbox/dark-v11"
            : "mapbox://styles/mapbox/light-v11"
          }
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={!readOnly ? onMapClick : undefined}
          attributionControl={true}
          reuseMaps
          onLoad={() => setIsMapLoaded(true)}
          onError={(e) => setMapError(e.error?.message || 'Failed to load map')}
        >
          {marker.latitude && marker.longitude && (
            <Marker
              longitude={marker.longitude}
              latitude={marker.latitude}
              draggable={!readOnly}
              onDragEnd={onMarkerDragEnd}
              color="#1768FF"
            />
          )}
          <NavigationControl position="top-right" />
        </Map>
      )}

      {/* Control buttons */}
      <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-2">
        {/* Current location button - only shown in edit mode */}
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            className={`${isDarkMode ? 'bg-gray-800/80 hover:bg-gray-800' : 'bg-white/80 hover:bg-white'}`}
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Locate className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Expand button */}
        {expandable && !expanded && (
          <Button
            variant="secondary"
            size="sm"
            className={`${isDarkMode ? 'bg-gray-800/80 hover:bg-gray-800' : 'bg-white/80 hover:bg-white'}`}
            onClick={handleExpand}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  // Render the component based on whether it's in the metadata section or not
  if (showInMetadata) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground mb-1">
          {location ? (
            <p>Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
          ) : (
            <p>No location set</p>
          )}
        </div>
        {renderMap(false)}
      </div>
    );
  }

  return (
    <>
      {renderMap(false)}

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Location</DialogTitle>
          </DialogHeader>
          {location && (
            <div className="text-sm text-muted-foreground mb-2">
              Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </div>
          )}
          {renderMap(true)}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapView;
