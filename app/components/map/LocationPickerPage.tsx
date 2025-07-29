'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import MapPicker from './MapPicker';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

interface LocationPickerPageProps {
  initialLocation?: Location | null;
  onSave: (location: Location | null) => void;
  onCancel: () => void;
  pageTitle?: string;
  isOwner?: boolean;
}

export default function LocationPickerPage({
  initialLocation,
  onSave,
  onCancel,
  pageTitle = "Set Location",
  isOwner = false
}: LocationPickerPageProps) {
  const router = useRouter();
  const [currentLocation, setCurrentLocation] = useState<Location | null>(initialLocation || null);
  const [savedZoom, setSavedZoom] = useState<number>(15);

  // Set initial zoom based on whether we have a location
  useEffect(() => {
    if (initialLocation) {
      console.log('🗺️ LocationPickerPage: Setting initial location:', initialLocation);
      setCurrentLocation(initialLocation);

      // Use saved zoom level if available, otherwise default to 15
      const zoomLevel = initialLocation.zoom || 15;
      console.log('🗺️ LocationPickerPage: Setting zoom level:', zoomLevel);
      setSavedZoom(zoomLevel);
    } else {
      setSavedZoom(0.5); // Extremely zoomed out to see the entire world
    }
  }, [initialLocation]);

  const handleSave = () => {
    console.log('🗺️ LocationPickerPage: handleSave called with:', currentLocation);
    console.log('🗺️ LocationPickerPage: savedZoom:', savedZoom);

    // Include zoom level in the saved location
    const locationWithZoom = currentLocation ? {
      ...currentLocation,
      zoom: savedZoom
    } : null;

    console.log('🗺️ LocationPickerPage: saving location with zoom:', locationWithZoom);
    onSave(locationWithZoom);
  };

  const handleClear = () => {
    setCurrentLocation(null);
    onSave(null);
  };

  const handleCancel = () => {
    // Go to previous page - users can reach home via WeWrite logo
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback to onCancel callback
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[9999]">
      {/* Full-screen Map Background */}
      <div className="absolute inset-0 z-0">
        <MapPicker
          location={currentLocation}
          onChange={isOwner ? (location) => {
            console.log('🗺️ LocationPickerPage: Location changed to:', location);
            setCurrentLocation(location);
          } : undefined}
          height="100vh"
          readOnly={!isOwner}
          showControls={false} // Hide zoom controls to prevent overlap with floating header
          initialZoom={savedZoom}
          onZoomChange={setSavedZoom}
          allowPanning={true} // Always allow panning for exploration
        />
      </div>

      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border border-border shadow-lg">
          <div className="flex items-center p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {isOwner ? 'Tap to add pin, pinch to zoom' : 'Page location'}
              </p>
            </div>
            <div className="w-10"></div> {/* Spacer to center the text */}
          </div>
        </div>
      </div>

      {/* Floating Bottom Buttons - Only show for owners */}
      {isOwner && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
          <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border border-border shadow-lg">
            <div className="p-4">
              {/* Action buttons */}
              <div className="flex gap-3">
                {currentLocation && (
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    className="flex-1 hover:bg-muted border-border text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}

                <Button
                  onClick={handleSave}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!currentLocation}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save Location
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
