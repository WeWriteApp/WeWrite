"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Copy, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { infiniteReloadDetector, type DebugInfo } from '../../utils/infiniteReloadDetector';

interface InfiniteReloadDebugModalProps {
  isOpen: boolean;
  debugInfo: DebugInfo;
  onClose: () => void;
  onBypass: () => void;
}

export function InfiniteReloadDebugModal({ 
  isOpen, 
  debugInfo, 
  onClose, 
  onBypass 
}: InfiniteReloadDebugModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formatDebugData = () => {
    const timestamp = new Date().toISOString();
    const data = {
      timestamp,
      url: window.location.href,
      userAgent: navigator.userAgent,
      debugInfo,
      reloadEvents: debugInfo.reloadEvents,
      authState: debugInfo.authState,
      navigationHistory: debugInfo.navigationHistory,
      consoleErrors: debugInfo.consoleErrors.slice(-10), // Last 10 errors
      browserInfo: debugInfo.browserInfo,
      storageContents: debugInfo.storageContents,
      networkStatus: debugInfo.networkStatus,
      componentStack: debugInfo.componentStack
    };

    return JSON.stringify(data, null, 2);
  };

  const copyToClipboard = async () => {
    try {
      const debugData = formatDebugData();
      await navigator.clipboard.writeText(debugData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: create a text area and select the text
      const textArea = document.createElement('textarea');
      textArea.value = formatDebugData();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBypass = () => {
    infiniteReloadDetector.reset();
    onBypass();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-90 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-xl font-bold">Infinite Reload Detected - Debug Information</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-red-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Circuit Breaker Triggered
              </h2>
              <p className="text-red-700 dark:text-red-300 text-sm">
                WeWrite detected {debugInfo.reloadEvents.length} consecutive page reloads within 30 seconds, 
                indicating a potential infinite reload loop. This safety mechanism has been activated to prevent 
                further issues.
              </p>
            </div>

            {/* Debug Data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reload Events */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Reload Events ({debugInfo.reloadEvents.length})
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {debugInfo.reloadEvents.map((event, i) => (
                      <div key={i} className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <div>#{i + 1} - {new Date(event.timestamp).toLocaleTimeString()}</div>
                        <div>URL: {event.url}</div>
                        {event.reason && <div>Reason: {event.reason}</div>}
                      </div>
                    ))}
                  </pre>
                </div>
              </div>

              {/* Authentication State */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Authentication State
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {JSON.stringify(debugInfo.authState, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Console Errors */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Recent Console Errors ({debugInfo.consoleErrors.length})
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {debugInfo.consoleErrors.length > 0 ? (
                      debugInfo.consoleErrors.map((error, i) => (
                        <div key={i} className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                          <div>{new Date(error.timestamp).toLocaleTimeString()}: {error.message}</div>
                          {error.stack && <div className="text-gray-600 dark:text-gray-400 mt-1">{error.stack.substring(0, 200)}...</div>}
                        </div>
                      ))
                    ) : (
                      'No console errors captured'
                    )}
                  </pre>
                </div>
              </div>

              {/* Navigation History */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Navigation History
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {debugInfo.navigationHistory.map((url, i) => (
                      <div key={i}>#{i + 1}: {url}</div>
                    ))}
                  </pre>
                </div>
              </div>

              {/* Browser Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Browser Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {JSON.stringify(debugInfo.browserInfo, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Network Status */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Network & Storage
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-40 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    Network Online: {debugInfo.networkStatus ? 'Yes' : 'No'}{'\n'}
                    {JSON.stringify(debugInfo.storageContents, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Component Stack */}
            {debugInfo.componentStack && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Component Stack Trace
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3 max-h-32 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {debugInfo.componentStack}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              This information can help developers identify the cause of infinite reload loops.
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={copyToClipboard}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied!' : 'Copy Debug Info'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBypass}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Bypass & Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InfiniteReloadDebugModal;
