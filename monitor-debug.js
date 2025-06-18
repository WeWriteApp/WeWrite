#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const debugLogPath = path.join(process.cwd(), 'debug.log');

console.log('🔍 WeWrite Debug Monitor');
console.log('Watching for debug events...');
console.log('Click the dense mode toggle now!\n');

// Clear existing log
if (fs.existsSync(debugLogPath)) {
  fs.unlinkSync(debugLogPath);
}

// Watch for changes to the debug log
let lastSize = 0;

const checkForUpdates = () => {
  if (fs.existsSync(debugLogPath)) {
    const stats = fs.statSync(debugLogPath);
    if (stats.size > lastSize) {
      const content = fs.readFileSync(debugLogPath, 'utf8');
      const newContent = content.slice(lastSize);
      process.stdout.write(newContent);
      lastSize = stats.size;
    }
  }
};

// Check every 100ms
setInterval(checkForUpdates, 100);

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n\n🔍 Debug monitoring stopped');
  process.exit(0);
});
