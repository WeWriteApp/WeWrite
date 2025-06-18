#!/usr/bin/env node

// Simple script to read debug information from localStorage
// Run this in the browser console to get debug info

const script = `
// Read debug information from localStorage
try {
  const debugData = localStorage.getItem('wewrite-debug');
  if (debugData) {
    const parsed = JSON.parse(debugData);
    console.log('=== WeWrite Debug Information ===');
    parsed.forEach((entry, index) => {
      console.log(\`\${index + 1}. [\${entry.timestamp}] \${entry.component} - \${entry.action || 'render'}\`);
      console.log('   Data:', entry);
      console.log('');
    });
  } else {
    console.log('No debug data found in localStorage');
  }
} catch (e) {
  console.error('Error reading debug data:', e);
}

// Also show current localStorage lineMode
console.log('Current localStorage lineMode:', localStorage.getItem('lineMode'));
`;

console.log('Copy and paste this script into the browser console:');
console.log('');
console.log(script);
