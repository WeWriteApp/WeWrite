// This script patches the google-logging-utils package to fix browser compatibility issues
// Specifically, it handles the process.stdout.isTTY check that fails in browser environments

const fs = require('fs');
const path = require('path');

// Path to node_modules
const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');

// Files to patch
const filesToPatch = [
  'google-logging-utils/build/src/colours.js',
  'google-logging-utils/build/src/logging-utils.js',
];

// Function to patch the colours.js file
function patchColoursFile(filePath) {
  const fullPath = path.join(nodeModulesPath, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace the isTTY check with a browser-safe version
  const originalContent = content;

  // Add a browser-safe check for stream.isTTY
  content = content.replace(
    /static isEnabled\(stream\) {/g,
    'static isEnabled(stream) {\n        // Browser-safe check for TTY\n        if (typeof stream === "undefined" || stream === null) {\n            return false;\n        }'
  );

  // Replace the refresh method that uses process.stderr
  content = content.replace(
    /static refresh\(\) {/g,
    'static refresh() {\n        // Browser-safe check\n        if (typeof process === "undefined" || !process.stderr) {\n            Colours.enabled = false;\n        } else {'
  );

  // Add closing brace for the else block in refresh method
  content = content.replace(
    /    }\n}/g,
    '    }\n    }\n}'
  );

  // Only write if content changed
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Patched: ${filePath}`);
    return true;
  } else {
    console.log(`⏭️ No changes needed: ${filePath}`);
    return false;
  }
}

// Function to patch the logging-utils.js file
function patchLoggingUtilsFile(filePath) {
  const fullPath = path.join(nodeModulesPath, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace the process.stdout references with browser-safe versions
  const originalContent = content;

  // Add browser-safe checks for process.stdout
  content = content.replace(
    /process\.stdout\.write/g,
    '(typeof process !== "undefined" && process.stdout && process.stdout.write ? process.stdout.write : (msg) => { console.log(msg); return true; })'
  );

  // Only write if content changed
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Patched: ${filePath}`);
    return true;
  } else {
    console.log(`⏭️ No changes needed: ${filePath}`);
    return false;
  }
}

// Main function
function patchGoogleLogging() {
  console.log('🔧 Patching google-logging-utils package...');

  let patchedCount = 0;

  // Patch the colours.js file
  if (patchColoursFile(filesToPatch[0])) {
    patchedCount++;
  }

  // Patch the logging-utils.js file
  if (patchLoggingUtilsFile(filesToPatch[1])) {
    patchedCount++;
  }

  console.log(`\n✅ Patching complete! Modified ${patchedCount} files.`);
}

// Run the patch
patchGoogleLogging();
