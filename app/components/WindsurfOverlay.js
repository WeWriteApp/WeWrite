"use client";

import React, { useState, useEffect } from 'react';
import DraggableWrapper from './DraggableWrapper';

/**
 * A draggable wrapper for the Windsurf overlay
 * This component finds the Windsurf overlay in the DOM and makes it draggable
 */
const WindsurfOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [overlayFound, setOverlayFound] = useState(false);

  // Toggle visibility with keyboard shortcut (Alt+Shift+W)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key === 'W') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Find and handle the Windsurf overlay
  useEffect(() => {
    if (!isVisible) return;

    // Look for the Windsurf overlay in the DOM
    const findWindsurfOverlay = () => {
      // This selector might need to be adjusted based on the actual Windsurf overlay structure
      const overlayElements = document.querySelectorAll('[data-windsurf-overlay], .windsurf-overlay, #windsurf-overlay');
      
      if (overlayElements.length > 0) {
        setOverlayFound(true);
        
        // For each overlay element found
        overlayElements.forEach(overlay => {
          // Store the original styles
          const originalStyles = {
            position: overlay.style.position,
            top: overlay.style.top,
            left: overlay.style.left,
            zIndex: overlay.style.zIndex,
            transition: overlay.style.transition,
            transform: overlay.style.transform,
          };
          
          // Store the original styles on the element for later restoration
          overlay.dataset.originalStyles = JSON.stringify(originalStyles);
          
          // Modify the overlay to be positioned inside our draggable wrapper
          overlay.style.position = 'static';
          overlay.style.top = 'auto';
          overlay.style.left = 'auto';
          overlay.style.transform = 'none';
          overlay.style.transition = 'none';
          
          // Move the overlay into our container
          const container = document.getElementById('windsurf-overlay-container');
          if (container && overlay.parentNode !== container) {
            container.appendChild(overlay);
          }
        });
      } else {
        setOverlayFound(false);
        // If not found immediately, try again after a short delay
        setTimeout(findWindsurfOverlay, 1000);
      }
    };
    
    findWindsurfOverlay();
    
    // Restore original state when component unmounts or becomes invisible
    return () => {
      const overlayElements = document.querySelectorAll('[data-windsurf-overlay], .windsurf-overlay, #windsurf-overlay');
      
      overlayElements.forEach(overlay => {
        if (overlay.dataset.originalStyles) {
          try {
            const originalStyles = JSON.parse(overlay.dataset.originalStyles);
            Object.assign(overlay.style, originalStyles);
            
            // Move back to body or original parent if needed
            document.body.appendChild(overlay);
          } catch (e) {
            console.error('Error restoring overlay styles', e);
          }
        }
      });
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <DraggableWrapper
      id="windsurf-overlay-wrapper"
      className="min-w-[300px]"
      initialPosition={{ x: 20, y: 20 }}
    >
      <div id="windsurf-overlay-container" className="p-3">
        {!overlayFound && (
          <div className="text-sm text-amber-500 p-2">
            Windsurf overlay not found. It may not be present on this page, or the selector needs to be updated.
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-2">
          Press Alt+Shift+W to toggle this wrapper
        </div>
      </div>
    </DraggableWrapper>
  );
};

export default WindsurfOverlay;
