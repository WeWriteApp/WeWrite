"use client";

import React from 'react';
import { useUpdateDetection } from '../../hooks/useUpdateDetection';
import { UpdateAvailableModal } from './update-available-modal';

interface UpdateDetectorProps {
  enabled?: boolean;
  checkInterval?: number;
}

/**
 * UpdateDetector Component
 * 
 * Automatically detects when app updates are available and shows
 * the update modal to users. Should be placed in the root layout.
 */
export function UpdateDetector({ 
  enabled = true, 
  checkInterval = 5 * 60 * 1000 // 5 minutes
}: UpdateDetectorProps) {
  const { 
    isUpdateAvailable, 
    dismissUpdate, 
    checkForUpdates 
  } = useUpdateDetection({ 
    enabled, 
    checkInterval 
  });

  const handleRefresh = () => {
    // This will be called before the page refreshes
    console.log('Refreshing app for update...');
  };

  const handleClose = () => {
    dismissUpdate();
  };

  return (
    <UpdateAvailableModal
      isOpen={isUpdateAvailable}
      onClose={handleClose}
      onRefresh={handleRefresh}
    />
  );
}
