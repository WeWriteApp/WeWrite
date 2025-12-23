'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import MapPicker from '../map/MapPicker';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

interface LocationFieldProps {
  location?: Location | null;
  canEdit?: boolean;
  onLocationChange?: (location: Location | null) => void;
  className?: string;
  pageId?: string;
  pageTitle?: string;
}

/**
 * LocationField Component
 *
 * Displays and allows editing of a page's location field.
 * Shows a mini map when location is set, and opens a full map picker for editing.
 */
export default function LocationField({
  location,
  canEdit = false,
  onLocationChange,
  className = "",
  pageId,
  pageTitle
}: LocationFieldProps) {
  const router = useRouter();

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

  const handleLocationClick = () => {
    const currentPath = window.location.pathname;

    // Check if we're on a new page creation route
    if (currentPath === '/new' || currentPath.startsWith('/new?')) {
      alert('Location editing for new pages will be available soon. Please save your page first to avoid losing content.');
      return;
    }

    // For existing pages, navigate to full-page location picker
    const locationData = normalizedLocation ? encodeURIComponent(JSON.stringify(normalizedLocation)) : '';
    const titleParam = pageTitle ? `&title=${encodeURIComponent(pageTitle)}` : '';
    router.push(`${currentPath}/location?return=${encodeURIComponent(currentPath)}&data=${locationData}&canEdit=${canEdit}${titleParam}`);
  };

  // Determine if the card should be clickable (no location set and can edit)
  const isCardClickable = !normalizedLocation && canEdit;

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
          {!normalizedLocation && (
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
      {normalizedLocation && (
        <div
          className={`h-40 md:h-48 ${canEdit ? 'cursor-pointer' : ''}`}
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
            initialZoom={normalizedLocation.zoom || 4}
          />
        </div>
      )}
    </div>
  );
}
