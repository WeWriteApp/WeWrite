"use client";

import React, { useState, useEffect } from 'react';
import { Map, Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Maximize2, MapPin } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
  expandable = true
}) => {
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

  // Update marker when location prop changes
  useEffect(() => {
    if (location) {
      setMarker({
        latitude: location.lat,
        longitude: location.lng
      });

      setViewState(prev => ({
        ...prev,
        latitude: location.lat,
        longitude: location.lng,
        zoom: prev.zoom < 10 ? 13 : prev.zoom
      }));
    }
  }, [location]);

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
    <div style={{ height: expanded ? '70vh' : height, width: '100%', position: 'relative' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        onClick={!readOnly ? onMapClick : undefined}
        attributionControl={true}
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

      {expandable && !expanded && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white"
          onClick={handleExpand}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      {renderMap(false)}

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Location</DialogTitle>
          </DialogHeader>
          {renderMap(true)}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapView;
