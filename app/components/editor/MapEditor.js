"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { MapPin, X } from 'lucide-react';

import MapView from './MapView';

/**
 * MapEditor Component - Feature Flagged
 *
 * Allows adding, editing, or removing a location on a map.
 * Only renders when the 'map' feature flag is enabled.
 */
const MapEditor = ({ location, onChange, compact = false }) => {
  // Map feature is now always enabled
  const mapFeatureEnabled = true;
  const [isOpen, setIsOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState(location);

  // Map feature is always enabled now

  const handleOpenChange = (open) => {
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

  const handleMapChange = (newLocation) => {
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
            <MapPin className="h-4 w-4 flex-shrink-0" />
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
                  <MapPin className="h-4 w-4 text-primary" />
                  Location set to {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
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
                  <X className="h-4 w-4" />
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