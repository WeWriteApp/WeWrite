'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import MapPicker from './MapPicker';
import { ConfirmationModal } from '../utils/ConfirmationModal';

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
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Set initial zoom based on whether we have a location
  useEffect(() => {
    if (initialLocation) {
      console.log('🗺️ LocationPickerPage: Setting initial location:', initialLocation);
      setCurrentLocation(initialLocation);

      // Use saved zoom level if available, otherwise default to moderate zoom
      const zoomLevel = initialLocation.zoom || 10;
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

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = () => {
    console.log('🗺️ LocationPickerPage: handleDeleteConfirm called - deleting location');
    setCurrentLocation(null);
    setShowDeleteConfirmation(false);
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
          onChange={(location) => {
            console.log('🗺️ LocationPickerPage: Location changed to:', location);
            setCurrentLocation(location);
          }}
          height="100vh"
          readOnly={false} // TEMP: Always allow editing for testing
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
              <Icon name="ArrowLeft" size={16} />
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
                    variant="secondary"
                    onClick={handleDeleteClick}
                    className="flex-1 hover:bg-muted border-border text-destructive hover:text-destructive"
                  >
                    <Icon name="Trash2" size={16} className="mr-1" />
                    Delete
                  </Button>
                )}

                <Button
                  onClick={handleSave}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!currentLocation}
                >
                  <Icon name="Check" size={16} className="mr-1" />
                  Save Location
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Location"
        message="Are you sure you want to delete this location? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        icon="delete"
      />
    </div>
  );
}
