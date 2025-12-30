'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import MapPicker, { MapMarker } from '../map/MapPicker';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';
import Modal from '../ui/modal';
import { Button } from '../ui/button';
import { ConfirmationModal } from '../utils/UnifiedModal';

// Local hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

interface LinkedPageLocation {
  id: string;
  title: string;
  location: Location;
}

interface LocationFieldProps {
  location?: Location | null;
  canEdit?: boolean;
  onLocationChange?: (location: Location | null) => void;
  className?: string;
  pageId?: string;
  pageTitle?: string;
  /** IDs of pages linked from this page's content */
  linkedPageIds?: string[];
}

/**
 * LocationField Component
 *
 * Displays and allows editing of a page's location field.
 * Shows a mini map when location is set, and opens a unified map detail view
 * that works in both view and edit mode.
 */
export default function LocationField({
  location,
  canEdit = false,
  onLocationChange,
  className = "",
  pageId,
  pageTitle,
  linkedPageIds = []
}: LocationFieldProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [linkedPagesWithLocations, setLinkedPagesWithLocations] = useState<LinkedPageLocation[]>([]);
  // Track loading state for linked page locations
  const [isLoadingLinkedPages, setIsLoadingLinkedPages] = useState(linkedPageIds.length > 0);
  // State for detail view drawer/modal
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  // State for editing within detail view
  const [editedLocation, setEditedLocation] = useState<Location | null>(null);
  const [savedZoom, setSavedZoom] = useState<number>(4);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Fetch locations of linked pages
  useEffect(() => {
    if (!linkedPageIds || linkedPageIds.length === 0) {
      setLinkedPagesWithLocations([]);
      setIsLoadingLinkedPages(false);
      return;
    }

    setIsLoadingLinkedPages(true);

    const fetchLinkedPageLocations = async () => {
      try {
        const response = await fetch('/api/pages/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageIds: linkedPageIds.slice(0, 50) }) // Limit to 50
        });

        if (!response.ok) {
          setIsLoadingLinkedPages(false);
          return;
        }

        const data = await response.json();
        const pagesWithLocations: LinkedPageLocation[] = [];

        for (const [id, pageData] of Object.entries(data.pages)) {
          if (pageData && (pageData as any).location) {
            const page = pageData as any;
            pagesWithLocations.push({
              id,
              title: page.title || 'Untitled',
              location: page.location
            });
          }
        }

        setLinkedPagesWithLocations(pagesWithLocations);
      } catch (error) {
        console.error('Error fetching linked page locations:', error);
      } finally {
        setIsLoadingLinkedPages(false);
      }
    };

    fetchLinkedPageLocations();
  }, [linkedPageIds]);

  // Convert linked pages to map markers
  const linkedPageMarkers: MapMarker[] = useMemo(() => {
    return linkedPagesWithLocations.map(page => ({
      id: page.id,
      location: page.location,
      title: page.title,
      color: '#6B7280', // neutral gray
      isCurrentPage: false
    }));
  }, [linkedPagesWithLocations]);

  // Handle legacy string locations (migrate to object format)
  const normalizedLocation = React.useMemo(() => {
    if (!location) return null;

    // If it's already an object with lat/lng, use it
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
      return location as Location;
    }

    // If it's a string, try to parse it (legacy format)
    if (typeof location === 'string' && location.trim()) {
      return null;
    }

    return null;
  }, [location]);

  // Track if this is adding a new location
  const isAddingNew = !normalizedLocation;

  // Check if location has changed
  const hasChanges = useMemo(() => {
    if (!normalizedLocation && !editedLocation) return false;
    if (!normalizedLocation && editedLocation) return true;
    if (normalizedLocation && !editedLocation) return true;
    if (!normalizedLocation || !editedLocation) return false;
    return normalizedLocation.lat !== editedLocation.lat || normalizedLocation.lng !== editedLocation.lng;
  }, [normalizedLocation, editedLocation]);

  // Open detail view
  const handleLocationClick = () => {
    const currentPath = window.location.pathname;

    // Check if we're on a new page creation route
    if (currentPath === '/new' || currentPath.startsWith('/new?')) {
      alert('Location editing for new pages will be available soon. Please save your page first to avoid losing content.');
      return;
    }

    // Reset edited location to current saved location
    setEditedLocation(normalizedLocation);
    setSavedZoom(normalizedLocation?.zoom || 4);
    setIsDetailViewOpen(true);
  };

  // Handle marker click - navigate to the page
  const handleMarkerClick = (marker: MapMarker) => {
    setIsDetailViewOpen(false);
    router.push(`/${marker.id}`);
  };

  // Handle location change from map tap (edit mode)
  const handleEditLocationChange = (newLocation: Location | null) => {
    if (!canEdit) return;
    setEditedLocation(newLocation);
  };

  // Save location
  const handleSave = async () => {
    if (!pageId || !canEdit) return;

    setIsSaving(true);
    try {
      const locationToSave = editedLocation ? {
        ...editedLocation,
        zoom: editedLocation.zoom || savedZoom
      } : null;

      const response = await fetch(`/api/pages/${pageId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locationToSave }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update location');
      }

      // Notify parent of change
      onLocationChange?.(locationToSave);
      setIsDetailViewOpen(false);

      // Refresh page to get updated data
      router.refresh();
    } catch (error) {
      console.error('Failed to save location:', error);
      alert(error instanceof Error ? error.message : 'Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete location
  const handleDeleteConfirm = async () => {
    if (!pageId || !canEdit) return;

    setIsSaving(true);
    setShowDeleteConfirmation(false);

    try {
      const response = await fetch(`/api/pages/${pageId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: null }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete location');
      }

      // Notify parent of change
      onLocationChange?.(null);
      setEditedLocation(null);
      setIsDetailViewOpen(false);

      // Refresh page to get updated data
      router.refresh();
    } catch (error) {
      console.error('Failed to delete location:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert changes
  const handleRevert = () => {
    setEditedLocation(normalizedLocation);
  };

  // Close detail view
  const handleClose = () => {
    setIsDetailViewOpen(false);
    setEditedLocation(null);
  };

  // Determine instruction text for detail view
  const getInstructionText = () => {
    if (isSaving) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Icon name="Loader" size={14} />
          Saving...
        </span>
      );
    }
    if (!canEdit) {
      return 'Page location';
    }
    if (isAddingNew && !editedLocation) {
      return 'Tap map to set location';
    }
    if (hasChanges) {
      return 'Tap to adjust, then save';
    }
    return 'Tap to change location';
  };

  // Determine if the card should be clickable (no location set and can edit)
  const isCardClickable = !normalizedLocation && canEdit && linkedPageMarkers.length === 0 && !isLoadingLinkedPages;

  // Show map if we have a location OR if we have linked pages with locations
  const hasMapContent = normalizedLocation || linkedPageMarkers.length > 0;

  // Don't render if there's nothing to show AND we're done loading
  // Wait until loading completes before hiding the card
  if (!hasMapContent && !canEdit && !isLoadingLinkedPages) {
    return null;
  }

  // Detail view content - shared between drawer and modal
  const detailViewContent = (
    <div className="flex flex-col h-full">
      {/* Map */}
      <div className={isMobile ? "h-64 w-full" : "h-80 w-full rounded-lg overflow-hidden"}>
        <MapPicker
          location={editedLocation}
          onChange={canEdit ? handleEditLocationChange : undefined}
          readOnly={!canEdit || isSaving}
          showControls={false}
          height="100%"
          disableZoom={false}
          allowPanning={true}
          initialZoom={savedZoom}
          onZoomChange={setSavedZoom}
          markers={linkedPageMarkers}
          onMarkerClick={handleMarkerClick}
          originalLocation={hasChanges ? normalizedLocation : undefined}
        />
      </div>

      {/* Instruction text for edit mode */}
      {canEdit && (
        <div className="px-4 py-2 text-center text-sm text-muted-foreground border-b border-border">
          {getInstructionText()}
        </div>
      )}

      {/* Legend */}
      <div className={`px-4 py-3 ${!canEdit ? 'border-t border-border' : ''} space-y-2`}>
        {(editedLocation || normalizedLocation) && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-sm text-accent font-medium">This page</span>
          </div>
        )}
        {linkedPageMarkers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-sm text-muted-foreground">Linked pages ({linkedPageMarkers.length})</span>
          </div>
        )}
        {linkedPagesWithLocations.length > 0 && (
          <div className="mt-3 space-y-1">
            {linkedPagesWithLocations.map(page => (
              <button
                key={page.id}
                onClick={() => handleMarkerClick({ id: page.id, location: page.location, title: page.title })}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                <Icon name="MapPin" size={14} className="text-muted-foreground" />
                <span className="text-sm truncate">{page.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit mode buttons */}
      {canEdit && !isSaving && (
        <div className="px-4 py-3 border-t border-border">
          {hasChanges ? (
            // When location has been changed: show Revert / Save / Delete
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRevert}
                className="flex-1"
                size="sm"
              >
                <Icon name="Undo2" size={14} className="mr-1.5" />
                Revert
              </Button>

              <Button
                onClick={handleSave}
                className="flex-1"
                size="sm"
              >
                <Icon name="Check" size={14} className="mr-1.5" />
                Save
              </Button>

              {normalizedLocation && (
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmation(true)}
                  className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  size="sm"
                >
                  <Icon name="Trash2" size={14} />
                </Button>
              )}
            </div>
          ) : normalizedLocation ? (
            // Viewing existing location without changes: show Delete
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirmation(true)}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              size="sm"
            >
              <Icon name="Trash2" size={14} className="mr-1.5" />
              Delete Location
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`wewrite-card wewrite-card-no-padding w-full overflow-hidden ${className} ${isCardClickable ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
      onClick={isCardClickable ? handleLocationClick : undefined}
    >
      {/* Header with padding */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="MapPin" size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium">Location</span>
        </div>

        <div className="flex items-center gap-2">
          {isLoadingLinkedPages && (
            <Icon name="Loader" size={16} className="text-muted-foreground" />
          )}
          {!isLoadingLinkedPages && !normalizedLocation && linkedPageMarkers.length === 0 && (
            <div
              className={`text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-theme-medium`}
            >
              {canEdit ? 'Tap to set location' : 'No location set'}
            </div>
          )}
          {normalizedLocation && canEdit && (
            <span className="text-muted-foreground text-sm">Tap to edit</span>
          )}
        </div>
      </div>

      {/* Map below header - full width, no padding */}
      {hasMapContent && (
        <>
          <div
            className={`h-40 md:h-48 cursor-pointer`}
            onClick={handleLocationClick}
          >
            <MapPicker
              location={normalizedLocation}
              readOnly={true}
              showControls={false}
              height="100%"
              className="pointer-events-none"
              disableZoom={true}
              allowPanning={false}
              initialZoom={normalizedLocation?.zoom || 4}
              markers={linkedPageMarkers}
            />
          </div>

          {/* Legend removed from collapsed view - only shown in detail view */}
        </>
      )}

      {/* Detail View - Drawer on mobile, Modal on desktop */}
      {isMobile ? (
        <Drawer open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>{pageTitle || 'Location'}</DrawerTitle>
            </DrawerHeader>
            {detailViewContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Modal
          isOpen={isDetailViewOpen}
          onClose={handleClose}
          title={pageTitle || 'Location'}
        >
          {detailViewContent}
        </Modal>
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
