'use client';

import React, { useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAccentColor } from '../../contexts/AccentColorContext';
import { useAuth } from '../../providers/AuthProvider';
import OpenStreetMapPicker from '../map/OpenStreetMapPicker';

interface Location {
  lat: number;
  lng: number;
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
    if (!location) return null;

    // If it's already an object with lat/lng, use it
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
      return location as Location;
    }

    // If it's a string, try to parse it (legacy format)
    if (typeof location === 'string' && location.trim()) {
      console.log('🗺️ LocationField: Found legacy string location:', location);
      // For now, return null for string locations - user will need to re-set
      return null;
    }

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
    return ACCENT_COLOR_VALUES[accentColor] || "#1768FF";
  };

  const accentColorValue = getAccentColorValue();

  const handleLocationClick = () => {
    if (canEdit) {
      // Navigate to full-page location picker
      const currentPath = window.location.pathname;
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
    <div className={`${className}`}>
      <div
        className={`flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
        onClick={canEdit ? handleLocationClick : undefined}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Location</span>
        </div>

        <div className="flex items-center gap-2">
          {normalizedLocation ? (
            <div className="flex items-center gap-2">
              {/* Mini map preview */}
              <div
                className="relative group"
                title={canEdit ? 'Click to edit location' : 'Click to view full map'}
              >
                <div className="w-12 h-8 rounded-sm overflow-hidden border border-border bg-muted/50">
                  <OpenStreetMapPicker
                    location={normalizedLocation}
                    readOnly={true}
                    showControls={false}
                    height="32px"
                    className="pointer-events-none"
                    initialZoom={savedZoom}
                  />
                </div>
              </div>

              {/* Coordinates display */}
              <div
                className="text-white text-sm font-medium px-2 py-1 rounded-md"
                style={{ backgroundColor: accentColorValue }}
                title={canEdit ? 'Click to edit location' : 'Click to view full map'}
              >
                {formatCoordinates(normalizedLocation)}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-border">
              {canEdit ? 'Click to set location' : 'No location set'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
