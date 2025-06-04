"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Maximize2 } from 'lucide-react';
import MapView from './MapView';
import { useState } from 'react';

/**
 * PageMetadataMap Component
 * 
 * Displays a map in the page metadata section with the ability to expand to a full view.
 * 
 * @param {Object} props
 * @param {Object} props.location - The location object with lat and lng properties
 */
const PageMetadataMap = ({ location }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!location) {
    return (
      <div className="bg-card dark:bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
        <span className="text-muted-foreground">No location set</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full rounded-2xl overflow-hidden bg-card dark:bg-card border border-border/40 shadow-sm">
        <MapView 
          location={location} 
          readOnly={true} 
          height="200px" 
          expandable={false}
          showInMetadata={true}
        />
        
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
          onClick={() => setIsExpanded(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Location</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </div>
          <div className="h-[70vh] w-full rounded-lg overflow-hidden">
            <MapView 
              location={location} 
              readOnly={true} 
              height="100%" 
              expandable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PageMetadataMap;
