"use client";

import { useEffect, useState } from 'react';
import {
  initIOSSafariFixes,
  isMobileSafari,
  detectInfiniteLoop,
  emergencyReset
} from "../../utils/ios-safari-fixes";
import { useAlert } from '../../hooks/useAlert';
import { AlertModal } from './UnifiedModal';

/**
 * Component that initializes iOS Safari fixes and provides emergency recovery
 */
export default function IOSSafariFixes() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showEmergencyReset, setShowEmergencyReset] = useState(false);

  // Custom modal hooks
  const { alertState, showSuccess, closeAlert } = useAlert();

  useEffect(() => {
    // Only initialize on iOS Safari
    if (!isMobileSafari()) return;

    console.log('IOSSafariFixes: Initializing for mobile Safari');

    // Initialize the fixes
    initIOSSafariFixes();
    setIsInitialized(true);

    // Check for infinite loop on mount
    if (detectInfiniteLoop()) {
      console.error('IOSSafariFixes: Infinite loop detected on mount');
      setShowEmergencyReset(true);
    }

    // Listen for emergency reset events
    const handleEmergencyReset = () => {
      console.log('IOSSafariFixes: Emergency reset event received');
      setShowEmergencyReset(true);
    };

    window.addEventListener('ios-safari-emergency-reset', handleEmergencyReset);

    // Set up periodic infinite loop detection
    const checkInterval = setInterval(() => {
      if (detectInfiniteLoop()) {
        console.error('IOSSafariFixes: Infinite loop detected during periodic check');
        setShowEmergencyReset(true);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('ios-safari-emergency-reset', handleEmergencyReset);
      clearInterval(checkInterval);
    };
  }, []);

  // Handle emergency reset button click
  const handleEmergencyReset = async () => {
    console.log('IOSSafariFixes: User triggered emergency reset');
    emergencyReset();
    setShowEmergencyReset(false);

    // Show success message briefly
    await showSuccess('Reset Complete', 'Emergency reset completed. The page will now reload normally.');

    // Reload after a short delay
    setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 1000);
  };

  // Only show emergency reset UI on iOS Safari when needed
  if (!isMobileSafari() || !showEmergencyReset) {
    return (
      <>
        {/* Always render the alert modal for iOS Safari */}
        {isMobileSafari() && (
          <AlertModal
            isOpen={alertState.isOpen}
            onClose={closeAlert}
            title={alertState.title}
            message={alertState.message}
            buttonText={alertState.buttonText}
            variant={alertState.variant}
            icon={alertState.icon}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Loading Issue Detected
          </h3>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            We've detected a potential infinite loading loop on your device. This can happen on iOS Safari due to browser-specific behavior.
            Click the button below to reset the app state and resolve the issue.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleEmergencyReset}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Reset App State
            </button>

            <button
              onClick={() => setShowEmergencyReset(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Continue Anyway
            </button>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            This reset will clear temporary data and should resolve loading issues without affecting your account or content.
          </p>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </div>
  );
}
