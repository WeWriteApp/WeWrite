"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';

/**
 * ZoomPreventionTest Component
 * 
 * This component provides a comprehensive test interface for verifying
 * that zoom prevention is working correctly across different scenarios.
 * 
 * Test Cases:
 * 1. Double-tap on text (should NOT zoom)
 * 2. Pinch gesture on content (should NOT zoom)
 * 3. Single tap on buttons (should work normally)
 * 4. Single finger scrolling (should work normally)
 * 5. Text selection (should work normally)
 */
export default function ZoomPreventionTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development or when explicitly enabled
  useEffect(() => {
    const showTest = process.env.NODE_ENV === 'development' || 
                     window.location.search.includes('zoom-test=true');
    setIsVisible(showTest);
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const handleButtonClick = () => {
    addTestResult('✅ Button click worked (normal interaction)');
  };

  const handleTextClick = () => {
    addTestResult('📝 Text clicked (check if zoom occurred)');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
        <h3 className="text-sm font-semibold mb-2">Zoom Prevention Test</h3>
        
        {/* Test Areas */}
        <div className="space-y-2 mb-3">
          <div 
            className="p-2 bg-muted rounded text-sm cursor-pointer"
            onClick={handleTextClick}
          >
            📱 Double-tap this text area to test zoom prevention
          </div>
          
          <div className="p-2 bg-muted rounded text-sm">
            🤏 Try pinch-to-zoom on this area
          </div>

          <div className="p-2 bg-muted rounded text-sm">
            🖱️ Try trackpad zoom (two-finger gesture) on this area
          </div>

          <div className="p-2 bg-accent rounded text-sm">
            ⌨️ Try Ctrl/Cmd + Plus/Minus (should work)
          </div>
          
          <Button 
            size="sm" 
            onClick={handleButtonClick}
            className="w-full"
          >
            🎯 Test Button Click
          </Button>
        </div>

        {/* Test Results */}
        <div className="text-xs space-y-1 mb-2 max-h-20 overflow-y-auto">
          {testResults.map((result, index) => (
            <div key={index} className="text-muted-foreground">
              {result}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={clearResults}>
            Clear
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsVisible(false)}>
            Hide
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          <div>• Double-tap text: Should NOT zoom</div>
          <div>• Pinch gesture: Should NOT zoom</div>
          <div>• Trackpad zoom: Should NOT zoom</div>
          <div>• Keyboard zoom (Ctrl/Cmd +/-): Should work</div>
          <div>• Button clicks: Should work normally</div>
          <div>• Scrolling: Should work normally</div>
        </div>
      </div>
    </div>
  );
}
