'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import MapPicker from './MapPicker';
import { ConfirmationModal } from '../utils/UnifiedModal';

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
  const [isSaving, setIsSaving] = useState(false);

  // Track if this is an "add new location" flow (no initial location)
  const isAddingNew = !initialLocation;

  // Check if location has been changed from initial
  const hasChanges = useMemo(() => {
    if (!initialLocation && !currentLocation) return false;
    if (!initialLocation && currentLocation) return true;
    if (initialLocation && !currentLocation) return true;
    if (!initialLocation || !currentLocation) return false;
    return initialLocation.lat !== currentLocation.lat || initialLocation.lng !== currentLocation.lng;
  }, [initialLocation, currentLocation]);

  // Set initial zoom based on whether we have a location
  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
      // Use saved zoom level, or default to 4 (USA overview)
      const zoomLevel = initialLocation.zoom || 4;
      setSavedZoom(zoomLevel);
    } else {
      setSavedZoom(4); // Zoomed out to see USA overview for picking location
    }
  }, [initialLocation]);

  const handleSave = (locationToSave?: Location | null) => {
    const location = locationToSave !== undefined ? locationToSave : currentLocation;

    // Include zoom level in the saved location
    // Use the location's zoom if it has one (from map click), otherwise use savedZoom
    const locationWithZoom = location ? {
      ...location,
      zoom: location.zoom || savedZoom
    } : null;

    onSave(locationWithZoom);
  };

  // Handle location change from map tap
  const handleLocationChange = (location: Location | null) => {
    setCurrentLocation(location);

    // If adding a new location (no initial location) and user taps to place a pin,
    // automatically save and return to the page
    if (isAddingNew && location && !isSaving) {
      setIsSaving(true);
      // Small delay to show the pin placement before navigating
      setTimeout(() => {
        handleSave(location);
      }, 300);
    }
  };

  const handleRevert = () => {
    setCurrentLocation(initialLocation || null);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = () => {
    setCurrentLocation(null);
    setShowDeleteConfirmation(false);
    onSave(null);
  };

  const handleCancel = () => {
    try {
      router.back();
    } catch (error) {
      onCancel();
    }
  };

  // Determine instruction text
  const getInstructionText = () => {
    if (isSaving) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Icon name="Loader" size={14} />
          Saving location...
        </span>
      );
    }
    if (!isOwner) {
      return 'Page location';
    }
    if (isAddingNew) {
      return 'Tap to set location';
    }
    if (hasChanges) {
      return 'Tap to adjust location';
    }
    return 'Tap to change location';
  };

  return (
    <div className="fixed inset-0 bg-background z-[9999]">
      {/* Full-screen Map Background */}
      <div className="absolute inset-0 z-0">
        <MapPicker
          location={currentLocation}
          onChange={isOwner ? handleLocationChange : undefined}
          height="100vh"
          readOnly={isSaving || !isOwner}
          showControls={false}
          initialZoom={savedZoom}
          onZoomChange={setSavedZoom}
          allowPanning={true}
          originalLocation={hasChanges ? initialLocation : undefined}
        />
      </div>

      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="bg-background rounded-lg border border-border shadow-lg">
          <div className="flex items-center p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="hover:bg-muted"
              disabled={isSaving}
            >
              <Icon name="ArrowLeft" size={16} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {getInstructionText()}
              </p>
            </div>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Buttons - Show when owner is viewing existing location */}
      {isOwner && !isAddingNew && !isSaving && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
          <div className="bg-background rounded-lg border border-border shadow-lg">
            <div className="p-4">
              {hasChanges ? (
                // When location has been changed: show Revert / Save / Delete
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRevert}
                    className="flex-1"
                  >
                    <Icon name="Undo2" size={16} className="mr-2" />
                    Revert
                  </Button>

                  <Button
                    onClick={() => handleSave()}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Icon name="Check" size={16} className="mr-2" />
                    Save
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={handleDeleteClick}
                    className="flex-1"
                  >
                    <Icon name="Trash2" size={16} className="mr-2" />
                    Delete
                  </Button>
                </div>
              ) : (
                // When viewing without changes: show just Delete button
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteClick}
                    className="flex-1"
                  >
                    <Icon name="Trash2" size={16} className="mr-2" />
                    Delete Location
                  </Button>
                </div>
              )}
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
