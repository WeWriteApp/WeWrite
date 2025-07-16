"use client";

import React from 'react';
import { MapPin } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import OpenStreetMapPicker from '../map/OpenStreetMapPicker';

/**
 * MapView Component - Feature Flagged
 *
 * This component is controlled by the 'map_view' feature flag.
 * When disabled, it shows a placeholder indicating the feature is not available.
 * When enabled, it loads the actual OpenStreetMap implementation.
 */
function MapView({ location, readOnly, onChange, height = '200px', expandable, showInMetadata }) {
  const mapFeatureEnabled = useFeatureFlag('map_view');

  if (!mapFeatureEnabled) {
    return (
      <div
        className="w-full bg-muted/50 rounded-lg flex items-center justify-center border border-muted/20"
        style={{ height }}
      >
        <div className="text-center space-y-2 p-4">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Map feature not available</p>
          <p className="text-xs text-muted-foreground">Feature flag disabled</p>
          {location && (
            <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
              <p className="font-medium">Saved Location:</p>
              <p className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render the actual OpenStreetMap implementation
  return (
    <OpenStreetMapPicker
      location={location}
      onChange={onChange}
      height={height}
      readOnly={readOnly}
      showControls={!readOnly}
      className="w-full"
    />
  );
}

export default MapView;
