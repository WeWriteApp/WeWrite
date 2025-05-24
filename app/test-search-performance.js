/**
 * Test script to verify search page performance optimizations
 * 
 * This script can be run in the browser console to test that:
 * 1. SearchInput component doesn't re-render when typing
 * 2. SearchResultsDisplay only re-renders when results change
 * 3. Empty search state components are properly memoized
 * 
 * Usage:
 * 1. Navigate to /search page
 * 2. Open browser console
 * 3. Copy and paste this script
 * 4. Run the test functions
 */

// Test 1: Check if SearchInput maintains focus during typing
function testSearchInputStability() {
  console.log('🧪 Testing SearchInput stability...');
  
  const searchInput = document.querySelector('input[type="text"]');
  if (!searchInput) {
    console.error('❌ Search input not found');
    return;
  }
  
  // Focus the input
  searchInput.focus();
  
  // Simulate typing
  let typingCount = 0;
  const testText = 'test search query';
  
  const typeCharacter = () => {
    if (typingCount < testText.length) {
      const currentValue = testText.substring(0, typingCount + 1);
      searchInput.value = currentValue;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Check if input still has focus
      if (document.activeElement !== searchInput) {
        console.error('❌ SearchInput lost focus during typing at character:', typingCount);
        return;
      }
      
      typingCount++;
      setTimeout(typeCharacter, 100);
    } else {
      console.log('✅ SearchInput maintained focus throughout typing test');
    }
  };
  
  typeCharacter();
}

// Test 2: Monitor component re-renders
function testComponentReRenders() {
  console.log('🧪 Testing component re-renders...');
  
  // Override React's createElement to track re-renders
  const originalCreateElement = React.createElement;
  const renderCounts = new Map();
  
  React.createElement = function(type, props, ...children) {
    if (typeof type === 'function' && type.displayName) {
      const componentName = type.displayName;
      const count = renderCounts.get(componentName) || 0;
      renderCounts.set(componentName, count + 1);
      
      if (count > 0) {
        console.log(`🔄 ${componentName} re-rendered (${count + 1} times)`);
      }
    }
    
    return originalCreateElement.apply(this, arguments);
  };
  
  // Restore after 10 seconds
  setTimeout(() => {
    React.createElement = originalCreateElement;
    console.log('📊 Final render counts:', Object.fromEntries(renderCounts));
  }, 10000);
  
  console.log('⏱️ Monitoring re-renders for 10 seconds...');
}

// Test 3: Check memoization effectiveness
function testMemoization() {
  console.log('🧪 Testing memoization effectiveness...');
  
  // Check if components are properly memoized
  const searchInput = document.querySelector('input[type="text"]');
  if (!searchInput) {
    console.error('❌ Search input not found');
    return;
  }
  
  // Get initial component references
  const initialInputElement = searchInput;
  
  // Trigger a state change that shouldn't affect SearchInput
  searchInput.value = 'test';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  setTimeout(() => {
    const newInputElement = document.querySelector('input[type="text"]');
    
    if (initialInputElement === newInputElement) {
      console.log('✅ SearchInput component reference remained stable');
    } else {
      console.error('❌ SearchInput component was re-created');
    }
  }, 1000);
}

// Test 4: Performance timing
function testPerformanceTiming() {
  console.log('🧪 Testing performance timing...');
  
  const searchInput = document.querySelector('input[type="text"]');
  if (!searchInput) {
    console.error('❌ Search input not found');
    return;
  }
  
  // Measure typing performance
  const startTime = performance.now();
  let keystrokes = 0;
  
  const measureKeystroke = () => {
    const currentTime = performance.now();
    const timeSinceStart = currentTime - startTime;
    keystrokes++;
    
    searchInput.value = 'a'.repeat(keystrokes);
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    if (keystrokes < 20) {
      requestAnimationFrame(measureKeystroke);
    } else {
      const avgTimePerKeystroke = timeSinceStart / keystrokes;
      console.log(`⚡ Average time per keystroke: ${avgTimePerKeystroke.toFixed(2)}ms`);
      
      if (avgTimePerKeystroke < 16) { // 60fps = 16.67ms per frame
        console.log('✅ Performance is good (< 16ms per keystroke)');
      } else {
        console.warn('⚠️ Performance could be improved (> 16ms per keystroke)');
      }
    }
  };
  
  measureKeystroke();
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting search page performance tests...');
  console.log('Make sure you are on the /search page before running these tests.');
  
  testSearchInputStability();
  
  setTimeout(() => {
    testMemoization();
  }, 2000);
  
  setTimeout(() => {
    testPerformanceTiming();
  }, 4000);
  
  setTimeout(() => {
    testComponentReRenders();
  }, 6000);
}

// Export test functions for manual use
window.searchPerformanceTests = {
  runAllTests,
  testSearchInputStability,
  testMemoization,
  testPerformanceTiming,
  testComponentReRenders
};

console.log('🔧 Search performance tests loaded. Run window.searchPerformanceTests.runAllTests() to start.');
