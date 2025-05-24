"use client";

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import SearchInput from '../components/SearchInput';
import RenderTracker from '../components/RenderTracker';

/**
 * Search Performance Test Page
 * 
 * This page is designed to test and compare different search input implementations
 * to identify performance bottlenecks and validate fixes.
 */
export default function SearchPerformanceTestPage() {
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState('');
  
  // Test 1: Basic Input (Control)
  const [basicInputValue, setBasicInputValue] = useState('');
  const handleBasicInputChange = useCallback((e) => {
    setBasicInputValue(e.target.value);
  }, []);

  // Test 2: SearchInput Component
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback((searchTerm) => {
    console.log('Search called with:', searchTerm);
    setSearchQuery(searchTerm);
    setIsLoading(true);
    
    // Simulate search delay
    setTimeout(() => {
      setSearchResults([
        { id: 1, title: `Result for "${searchTerm}"`, type: 'page' },
        { id: 2, title: `Another result for "${searchTerm}"`, type: 'user' }
      ]);
      setIsLoading(false);
    }, 300);
  }, []);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleSave = useCallback((searchTerm) => {
    console.log('Save search:', searchTerm);
  }, []);

  const handleSubmit = useCallback((searchTerm) => {
    console.log('Submit search:', searchTerm);
    handleSearch(searchTerm);
  }, [handleSearch]);

  // Performance monitoring
  const renderCount = useRef(0);
  renderCount.current += 1;

  const startPerformanceTest = useCallback((testName) => {
    setCurrentTest(testName);
    const startTime = performance.now();
    
    // Record test start
    setTestResults(prev => [...prev, {
      test: testName,
      startTime,
      status: 'running'
    }]);
  }, []);

  const endPerformanceTest = useCallback((testName) => {
    const endTime = performance.now();
    
    setTestResults(prev => prev.map(result => 
      result.test === testName && result.status === 'running'
        ? { ...result, endTime, duration: endTime - result.startTime, status: 'completed' }
        : result
    ));
    
    setCurrentTest('');
  }, []);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <RenderTracker
        name="SearchPerformanceTestPage"
        props={{
          renderCount: renderCount.current,
          currentTest,
          basicInputValue,
          searchQuery,
          resultsCount: searchResults.length,
          isLoading
        }}
      />

      <h1 className="text-3xl font-bold mb-8">Search Performance Test</h1>
      
      <div className="space-y-8">
        {/* Test 1: Basic Input Control */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test 1: Basic Input (Control)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This is a basic input field with no additional logic. It should be perfectly responsive.
          </p>
          
          <Input
            value={basicInputValue}
            onChange={handleBasicInputChange}
            placeholder="Type here to test basic input responsiveness..."
            className="w-full"
          />
          
          <div className="mt-2 text-sm text-muted-foreground">
            Value: "{basicInputValue}" (Length: {basicInputValue.length})
          </div>
        </div>

        {/* Test 2: SearchInput Component */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test 2: SearchInput Component</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This uses the actual SearchInput component with debouncing and callbacks.
          </p>
          
          <SearchInput
            initialValue=""
            onSearch={handleSearch}
            onClear={handleClear}
            onSave={handleSave}
            onSubmit={handleSubmit}
            autoFocus={false}
            placeholder="Type here to test SearchInput performance..."
          />
          
          <div className="mt-4 space-y-2">
            <div className="text-sm text-muted-foreground">
              Current Query: "{searchQuery}"
            </div>
            <div className="text-sm text-muted-foreground">
              Loading: {isLoading ? 'Yes' : 'No'}
            </div>
            <div className="text-sm text-muted-foreground">
              Results: {searchResults.length} items
            </div>
          </div>
        </div>

        {/* Performance Test Controls */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Performance Test Controls</h2>
          
          <div className="flex gap-4 mb-4">
            <Button 
              onClick={() => startPerformanceTest('typing-speed')}
              disabled={currentTest !== ''}
            >
              Start Typing Speed Test
            </Button>
            
            <Button 
              onClick={() => endPerformanceTest('typing-speed')}
              disabled={currentTest !== 'typing-speed'}
            >
              End Typing Speed Test
            </Button>
            
            <Button 
              onClick={() => setTestResults([])}
              variant="outline"
            >
              Clear Results
            </Button>
          </div>
          
          {currentTest && (
            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <strong>Active Test:</strong> {currentTest}
              <br />
              <em>Type in the SearchInput above to test performance</em>
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{result.test}</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    result.status === 'running' ? 'bg-yellow-200' : 'bg-green-200'
                  }`}>
                    {result.status === 'running' ? 'Running...' : `${result.duration?.toFixed(2)}ms`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="border rounded-lg p-6 bg-blue-50">
          <h2 className="text-xl font-semibold mb-4">Testing Instructions</h2>
          
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>First, test the basic input field. It should be perfectly responsive with no lag.</li>
            <li>Then, test the SearchInput component. Compare the responsiveness to the basic input.</li>
            <li>Open browser DevTools and monitor the Console for render tracking logs.</li>
            <li>Use the Performance Test Controls to measure typing speed and responsiveness.</li>
            <li>Look for any differences in behavior between the two input fields.</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-100 rounded">
            <strong>Expected Behavior:</strong> Both input fields should feel equally responsive. 
            If the SearchInput feels sluggish, there's a performance issue to investigate.
          </div>
        </div>
      </div>
    </div>
  );
}
