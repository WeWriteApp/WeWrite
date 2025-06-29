"use client";

// Temporarily disabled MapView to debug webpack runtime error
import React from 'react';
import { MapPin } from 'lucide-react';

/**
 * MapView Component - Temporarily Disabled
 *
 * This component has been temporarily disabled to debug webpack runtime errors.
 * The mapbox-gl and react-map-gl dependencies were causing webpack chunk loading issues.
 */
function MapView({ location, readOnly, onChange, height = '200px', expandable, showInMetadata }) {
  return (
    <div
      className="w-full bg-muted/50 rounded-lg flex items-center justify-center border border-muted/20"
      style={{ height }}
    >
      <div className="text-center space-y-2 p-4">
        <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Map temporarily disabled</p>
        <p className="text-xs text-muted-foreground">Debugging webpack runtime issues</p>
        {location && (
          <p className="text-xs text-muted-foreground">
            Location: {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}

export default MapView;