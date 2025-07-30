'use client';

import React from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import MapPicker from './MapPicker';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

interface FullScreenMapViewProps {
  location: Location;
  pageTitle?: string;
  onBack: () => void;
  className?: string;
}

/**
 * FullScreenMapView Component
 *
 * A full-screen map view that displays a page's location with a back button.
 * Used when users click on the mini map in page details to see the location
 * in a larger, more detailed view.
 */
export default function FullScreenMapView({
  location,
  pageTitle,
  onBack,
  className = ""
}: FullScreenMapViewProps) {
  const formatCoordinates = (loc: Location) => {
    return `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
  };

  return (
    <div className={`fixed inset-0 bg-background z-50 flex flex-col ${className}`}>
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Go to previous page - users can reach home via WeWrite logo
            try {
              // Try to go back in history first
              window.history.back();
            } catch (error) {
              console.error("Navigation error:", error);
              // Fallback to onBack callback
              onBack();
            }
          }}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <div className="flex items-center gap-2 flex-1">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">
              {pageTitle ? `${pageTitle} - Location` : 'Page Location'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatCoordinates(location)}
            </p>
          </div>
        </div>
      </div>

      {/* Full-screen map */}
      <div className="flex-1 relative">
        <MapPicker
          location={location}
          readOnly={true}
          showControls={false}
          height="100%"
          className="absolute inset-0"
          initialZoom={location?.zoom} // Use the saved zoom level to prevent layout shift
        />
      </div>

      {/* Footer with location info */}
      <div className="p-4 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm font-medium">
                Location: {formatCoordinates(location)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>© OpenStreetMap contributors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
