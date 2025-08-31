'use client';

import React, { useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAccentColor } from '../../contexts/AccentColorContext';
import { useAuth } from '../../providers/AuthProvider';
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
}

/**
 * LocationField Component
 *
 * Displays and allows editing of a page's location field.
 * Shows a mini map when location is set, and opens a full map picker for editing.
 * Similar to CustomDateField but for geographic coordinates.
 */
export default function LocationField({
  location,
  canEdit = false,
  onLocationChange,
  className = ""
}: LocationFieldProps) {
  const { accentColor, customColors } = useAccentColor();
  const { user } = useAuth();
  // Map feature is now always enabled
  const mapFeatureEnabled = true;
  const router = useRouter();
  const [savedZoom, setSavedZoom] = useState<number>(15);

  // Handle legacy string locations (migrate to object format)
  const normalizedLocation = React.useMemo(() => {
    console.log('🗺️ LocationField: Processing location:', location, 'type:', typeof location);

    if (!location) {
      console.log('🗺️ LocationField: No location provided');
      return null;
    }

    // If it's already an object with lat/lng, use it
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
      console.log('🗺️ LocationField: Valid location object:', location);
      return location as Location;
    }

    // If it's a string, try to parse it (legacy format)
    if (typeof location === 'string' && location.trim()) {
      console.log('🗺️ LocationField: Found legacy string location:', location);
      // For now, return null for string locations - user will need to re-set
      return null;
    }

    console.log('🗺️ LocationField: Invalid location format');
    return null;
  }, [location]);

  // Don't render if map feature is disabled
  if (!mapFeatureEnabled) {
    return null;
  }

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor];
    }
    // Default accent color values
    const ACCENT_COLOR_VALUES: Record<string, string> = {
      blue: "#1768FF",
      green: "#10B981",
      purple: "#8B5CF6",
      red: "#EF4444",
      orange: "#F97316",
      pink: "#EC4899",
      yellow: "#EAB308",
      indigo: "#6366F1",
      teal: "#14B8A6",
      cyan: "#06B6D4"
    };
    return ACCENT_COLOR_VALUES[accentColor] || "oklch(var(--primary))";
  };

  const accentColorValue = getAccentColorValue();

  const handleLocationClick = () => {
    if (canEdit) {
      // CRITICAL FIX: Don't navigate away from new pages to prevent content loss
      // Instead, show an inline location picker modal
      const currentPath = window.location.pathname;

      // Check if we're on a new page creation route
      if (currentPath === '/new' || currentPath.startsWith('/new?')) {
        // TODO: Implement inline location picker modal for new pages
        // For now, show alert to prevent content loss
        alert('Location editing for new pages will be available soon. Please save your page first to avoid losing content.');
        return;
      }

      // For existing pages, navigate to full-page location picker
      const locationData = normalizedLocation ? encodeURIComponent(JSON.stringify(normalizedLocation)) : '';
      router.push(`${currentPath}/location?return=${encodeURIComponent(currentPath)}&data=${locationData}`);
    } else if (normalizedLocation) {
      // Navigate to view-only location page
      const currentPath = window.location.pathname;
      const locationData = encodeURIComponent(JSON.stringify(normalizedLocation));
      router.push(`${currentPath}/location/view?return=${encodeURIComponent(currentPath)}&data=${locationData}`);
    }
  };



  const formatCoordinates = (loc: Location) => {
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`wewrite-card w-full overflow-hidden ${canEdit ? 'cursor-pointer wewrite-interactive-card' : ''}`}
        onClick={canEdit ? handleLocationClick : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Location</span>
          </div>

          <div className="flex items-center gap-2">
            {!normalizedLocation && (
              <div className="text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-theme-medium">
                {canEdit ? 'Click to set location' : 'No location set'}
              </div>
            )}
          </div>
        </div>

        {/* Map below header - only show if location exists */}
        {normalizedLocation && (
            <div className="h-40 md:h-48 border-t border-theme-light">
              <MapPicker
                location={normalizedLocation}
                readOnly={true}
                showControls={false}
                height="100%"
                className="pointer-events-none"
                disableZoom={true} // Disable zooming in collapsed state
                allowPanning={false} // Disable panning in collapsed state
                initialZoom={normalizedLocation.zoom || 10} // Use saved zoom level to match fullscreen view
              />
            </div>
        )}
      </div>
    </div>
  );
}
