"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from "../ui/button";

export default function ZoomControl() {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showControls, setShowControls] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, distance: 0 });
  const lastPinchDistanceRef = useRef(0);
  const zoomChangeThreshold = 5; // Minimum zoom change to trigger a zoom update

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Apply initial zoom level to the document
    // Use transform scale instead of zoom for better browser compatibility and to scale all elements
    document.documentElement.style.transform = `scale(${zoomLevel / 100})`;
    document.documentElement.style.transformOrigin = 'top center';
    // Set height to ensure the scaled content doesn't get cut off
    document.documentElement.style.height = `${10000 / zoomLevel * 100}px`;

    // Function to handle touch start
    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Store the initial touch positions for pinch detection
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate distance between touch points
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        touchStartRef.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
          distance: distance
        };

        lastPinchDistanceRef.current = distance;
      }
    };

    // Function to handle touch move (for pinch zoom)
    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        // Prevent default to disable browser's native zoom
        e.preventDefault();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate current distance between touch points
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        // Calculate zoom change based on pinch gesture
        const initialDistance = touchStartRef.current.distance;
        if (initialDistance > 0) {
          // Calculate zoom change factor
          const distanceChange = currentDistance - lastPinchDistanceRef.current;

          // Only update if the change is significant enough
          if (Math.abs(distanceChange) > zoomChangeThreshold) {
            // Determine zoom direction and amount
            const zoomChange = distanceChange > 0 ? 5 : -5;
            const newZoomLevel = Math.max(50, Math.min(200, zoomLevel + zoomChange));

            // Update zoom level
            setZoomLevel(newZoomLevel);
            document.documentElement.style.transform = `scale(${newZoomLevel / 100})`;
            document.documentElement.style.transformOrigin = 'top center';
            document.documentElement.style.height = `${10000 / newZoomLevel * 100}px`;

            // Always show controls when zoomed
            setShowControls(true);

            // Update last pinch distance
            lastPinchDistanceRef.current = currentDistance;
          }
        }
      }
    };

    // Function to handle touch end
    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        // Reset touch tracking when pinch ends
        touchStartRef.current = { x: 0, y: 0, distance: 0 };
      }
    };

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Clean up
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomLevel]);

  const handleZoomIn = () => {
    const newZoomLevel = Math.min(200, zoomLevel + 10);
    setZoomLevel(newZoomLevel);
    document.documentElement.style.transform = `scale(${newZoomLevel / 100})`;
    document.documentElement.style.transformOrigin = 'top center';
    document.documentElement.style.height = `${10000 / newZoomLevel * 100}px`;
  };

  const handleZoomOut = () => {
    const newZoomLevel = Math.max(50, zoomLevel - 10);
    setZoomLevel(newZoomLevel);
    document.documentElement.style.transform = `scale(${newZoomLevel / 100})`;
    document.documentElement.style.transformOrigin = 'top center';
    document.documentElement.style.height = `${10000 / newZoomLevel * 100}px`;
  };

  const resetZoom = () => {
    setZoomLevel(100);
    document.documentElement.style.transform = 'scale(1)';
    document.documentElement.style.transformOrigin = 'top center';
    document.documentElement.style.height = '100%';
    setShowControls(false);
  };

  // Always show reset button when zoomed
  if (zoomLevel === 100) return null;

  return (
    <div className="fixed bottom-20 right-6 z-[9999] flex flex-col gap-2">
      <Button
        variant="outline"
        size="icon"
        className="bg-background/80 backdrop-blur-sm shadow-lg border-theme-medium"
        onClick={handleZoomIn}
        aria-label="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="bg-background/80 backdrop-blur-sm shadow-lg border-theme-medium"
        onClick={handleZoomOut}
        aria-label="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        className="bg-background/80 backdrop-blur-sm shadow-lg border-theme-medium text-primary font-medium"
        onClick={resetZoom}
        aria-label="Reset Zoom"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset ({zoomLevel}%)
      </Button>
    </div>
  );
}
