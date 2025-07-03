"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Modal } from './modal';
import { RefreshCw, Download } from 'lucide-react';

interface UpdateAvailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * UpdateAvailableModal Component
 * 
 * Shows a modal when a new app update is available, allowing users to
 * refresh the page to get the latest version with cache clearing.
 */
export function UpdateAvailableModal({ isOpen, onClose, onRefresh }: UpdateAvailableModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Clear all caches before refreshing
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Clear service worker cache if available
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
      }

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Call the refresh callback
      onRefresh();
      
      // Force a hard refresh
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      // Still refresh even if cache clearing fails
      window.location.reload();
    }
  };

  const handleLater = () => {
    onClose();
    // Set a flag to remind user later (optional)
    localStorage.setItem('updateDismissedAt', Date.now().toString());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} preventClickOutside={true}>
      <div className="p-6 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">New Update Available</h2>
            <p className="text-sm text-muted-foreground">
              A new version of WeWrite is ready
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">
            We've released a new version with improvements and bug fixes. 
            Refresh now to get the latest features and ensure the best experience.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <strong>What happens when you refresh:</strong>
            <ul className="mt-1 space-y-1 ml-4 list-disc">
              <li>Cache will be cleared for fresh content</li>
              <li>Latest features and fixes will be loaded</li>
              <li>Your work will be preserved</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Now
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleLater}
            disabled={isRefreshing}
            className="flex-1"
          >
            Later
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          You can also refresh manually anytime by pressing Ctrl+F5 (Cmd+Shift+R on Mac)
        </p>
      </div>
    </Modal>
  );
}
