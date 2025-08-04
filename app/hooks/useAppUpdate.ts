'use client';

import { useEffect, useState } from 'react';

interface AppUpdateState {
  isUpdateAvailable: boolean;
  showModal: boolean;
  checkForUpdates: () => void;
  dismissUpdate: () => void;
  applyUpdate: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastBuildTime, setLastBuildTime] = useState<string | null>(null);

  const checkForUpdates = async () => {
    try {
      // Check for build time changes by fetching a timestamp endpoint
      const response = await fetch('/api/build-info', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const currentBuildTime = data.buildTime || data.timestamp;
        
        if (lastBuildTime && lastBuildTime !== currentBuildTime) {
          console.log('🔄 App update detected:', { 
            previous: lastBuildTime, 
            current: currentBuildTime 
          });
          setIsUpdateAvailable(true);
          setShowModal(true);
        }
        
        setLastBuildTime(currentBuildTime);
      }
    } catch (error) {
      console.warn('Failed to check for app updates:', error);
    }
  };

  const dismissUpdate = () => {
    setShowModal(false);
    // Don't reset isUpdateAvailable - keep it true until refresh
  };

  const applyUpdate = () => {
    setShowModal(false);
    // The modal component handles the actual refresh
  };

  useEffect(() => {
    // Initial check
    checkForUpdates();
    
    // Check for updates every 30 seconds
    const interval = setInterval(checkForUpdates, 30000);
    
    // Check when the page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check when the page regains focus
    const handleFocus = () => {
      checkForUpdates();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [lastBuildTime]);

  return {
    isUpdateAvailable,
    showModal,
    checkForUpdates,
    dismissUpdate,
    applyUpdate
  };
}
