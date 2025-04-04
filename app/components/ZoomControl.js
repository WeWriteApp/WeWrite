"use client";

import React, { useState, useEffect } from 'react';
import { ZoomIn } from 'lucide-react';
import { Button } from './ui/button';

export default function ZoomControl() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [initialScale, setInitialScale] = useState(1);
  const [showResetButton, setShowResetButton] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store the initial scale value
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || 'width=device-width, initial-scale=1.0';
      // Enable pinch zoom by removing user-scalable=no if present
      if (content.includes('user-scalable=no')) {
        const newContent = content.replace('user-scalable=no', 'user-scalable=yes');
        viewport.setAttribute('content', newContent);
      }

      // Get initial scale
      const initialScaleMatch = content.match(/initial-scale=([0-9.]+)/);
      if (initialScaleMatch && initialScaleMatch[1]) {
        setInitialScale(parseFloat(initialScaleMatch[1]));
      } else {
        setInitialScale(1.0); // Default if not specified
      }
    }

    // Function to detect zoom changes
    const detectZoomChange = () => {
      // We'll use a simpler approach - just check if the visual viewport scale has changed
      if (typeof window.visualViewport !== 'undefined') {
        const checkZoom = () => {
          const currentZoom = window.visualViewport.scale;
          if (Math.abs(currentZoom - 1.0) > 0.1) {
            setIsZoomed(true);
            setShowResetButton(true);
          } else {
            setIsZoomed(false);
            setShowResetButton(false);
          }
        };

        // Check zoom when visual viewport changes
        window.visualViewport.addEventListener('resize', checkZoom);

        // Initial check
        checkZoom();

        // Clean up
        return () => {
          window.visualViewport.removeEventListener('resize', checkZoom);
        };
      }

      return () => {};
    };

    // Set up the zoom detection
    const cleanup = detectZoomChange();

    return cleanup;
  }, [initialScale]);

  const resetZoom = () => {
    // Use modern browser APIs to reset zoom
    if (typeof window !== 'undefined') {
      if (document.body.style.zoom) {
        document.body.style.zoom = '100%';
      }

      // For mobile browsers, update the viewport
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }

      // If the browser supports it, use the visualViewport API
      if (window.visualViewport && window.scrollTo) {
        window.scrollTo(0, 0);
      }

      setIsZoomed(false);
      setShowResetButton(false);
    }
  };

  // Only render the reset button if the user has zoomed
  if (!showResetButton) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="fixed bottom-20 right-6 z-50 bg-background/80 backdrop-blur-sm shadow-lg border-theme-medium"
      onClick={resetZoom}
    >
      <ZoomIn className="h-4 w-4 mr-2" />
      Reset Zoom
    </Button>
  );
}
