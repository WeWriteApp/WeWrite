"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

import MapView from './MapView';

interface Location {
  lat: number;
  lng: number;
}

interface MapEditorProps {
  location: Location | null;
  onChange: (location: Location | null) => void;
  compact?: boolean;
}

/**
 * MapEditor Component - Feature Flagged
 *
 * Allows adding, editing, or removing a location on a map.
 * Only renders when the 'map' feature flag is enabled.
 */
const MapEditor: React.FC<MapEditorProps> = ({ location, onChange, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<Location | null>(location);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTempLocation(location);
    }
  };

  const handleSave = () => {
    onChange(tempLocation);
    setIsOpen(false);
  };

  const handleRemove = () => {
    onChange(null);
    setIsOpen(false);
  };

  const handleMapChange = (newLocation: Location | null) => {
    setTempLocation(newLocation);
  };

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant={location ? "default" : "outline"}
            className={`flex items-center gap-1.5 bg-background/90 border-input ${
              compact ? "justify-center w-12 h-12 p-0" : ""
            }`}
            title={compact ? (location ? 'Edit Location' : 'Add Location') : ""}
          >
            <Icon name="MapPin" size={16} className="flex-shrink-0" />
            {!compact && (
              <span className="text-sm font-medium">{location ? 'Edit Location' : 'Add Location'}</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{location ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
              <MapView
                location={tempLocation}
                readOnly={false}
                onChange={handleMapChange}
                height="400px"
                expandable={false}
              />
            </div>
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              {tempLocation ? (
                <p className="flex items-center gap-2">
                  <Icon name="MapPin" size={16} className="text-primary" />
                  Location set to {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <Icon name="MapPin" size={16} />
                  Search for a location, use your current location, or tap on the map to set a location
                </p>
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              {location && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  className="gap-2"
                  size="sm"
                >
                  <Icon name="X" size={16} />
                  Remove Location
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!tempLocation}
                  variant="success"
                  className="min-w-[80px]"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MapEditor;
