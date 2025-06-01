"use client";

import { useEffect, useState } from 'react';
import { initializeRefreshDebugger, getDebugInfo, exportDebugInfo } from '../../utils/infinite-refresh-debugger';

/**
 * Infinite Refresh Protection Component
 * 
 * This component initializes the infinite refresh debugger and provides
 * a user interface for debugging refresh issues.
 */
export function InfiniteRefreshProtection({ showDebugPanel = false }) {
  const [debugInfo, setDebugInfo] = useState(null);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [showPanel, setShowPanel] = useState(showDebugPanel);

  useEffect(() => {
    // Initialize the refresh debugger
    const initResult = initializeRefreshDebugger();
    
    if (!initResult) {
      // Infinite refresh was detected
      setIsProtectionActive(true);
    }

    // Update debug info
    setDebugInfo(getDebugInfo());

    // Set up periodic debug info updates
    const interval = setInterval(() => {
      setDebugInfo(getDebugInfo());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Show debug panel in development or when explicitly requested
  const shouldShowPanel = showPanel || (process.env.NODE_ENV === 'development' && debugInfo);

  if (!shouldShowPanel) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 10000,
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: isProtectionActive ? '#dc3545' : '#28a745' }}>
        🛡️ Refresh Protection
      </div>
      
      {isProtectionActive && (
        <div style={{ marginBottom: '10px', color: '#dc3545' }}>
          ⚠️ Protection Active - Infinite refresh detected
        </div>
      )}

      {debugInfo && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          <div>Recent Refreshes: {debugInfo.recentRefreshes.length}</div>
          <div>Total History: {debugInfo.refreshHistory.length}</div>
          <div>Current URL: {debugInfo.currentUrl.substring(0, 30)}...</div>
          <div>Prevention: {debugInfo.refreshPreventionActive ? 'Active' : 'Inactive'}</div>
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowPanel(!showPanel)}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {showPanel ? 'Hide' : 'Show'}
        </button>
        
        <button
          onClick={exportDebugInfo}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Export
        </button>
        
        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
          }}
          style={{
            background: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/**
 * Refresh Protection Status Component
 * 
 * A minimal component that just shows the protection status
 */
export function RefreshProtectionStatus() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const isProtectionActive = sessionStorage.getItem('refresh_prevention_active') === 'true';
      setIsActive(isProtectionActive);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isActive) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#dc3545',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '5px',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 10000,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
    }}>
      🛡️ Refresh Protection Active
    </div>
  );
}
