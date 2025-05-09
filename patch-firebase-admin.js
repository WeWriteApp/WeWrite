// This script patches the firebase-admin package to replace node: protocol imports
// with regular imports to make it compatible with Next.js client-side bundling

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to node_modules
const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');

// Files to patch
const filesToPatch = [
  // Main files that use node: protocol
  'firebase-admin/lib/default-namespace.js',
  '@fastify/busboy/deps/streamsearch/sbmh.js',
  '@fastify/busboy/deps/dicer/lib/HeaderParser.js',
  '@fastify/busboy/deps/dicer/lib/Dicer.js',
  '@fastify/busboy/lib/main.js',
  '@grpc/grpc-js/build/src/resolver-dns.js',
  'google-logging-utils/build/src/logging-utils.js',
  'gcp-metadata/build/src/index.js',
  'google-auth-library/build/src/index.js',
  'firebase-admin/lib/app/credential-internal.js',
  'firebase-admin/lib/utils/index.js',
  'firebase-admin/lib/app/index.js',
  'firebase-admin/lib/esm/app/index.js',
];

// Function to patch a file
function patchFile(filePath) {
  const fullPath = path.join(nodeModulesPath, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace node: protocol imports with regular imports
  const originalContent = content;
  content = content.replace(/require\(['"]node:([^'"]+)['"]\)/g, "require('$1')");
  content = content.replace(/from ['"]node:([^'"]+)['"]/g, "from '$1'");
  content = content.replace(/import ['"]node:([^'"]+)['"]/g, "import '$1'");

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

// Function to recursively search for files with node: imports
function findFilesWithNodeImports(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules inside node_modules to avoid infinite recursion
      if (file !== 'node_modules') {
        findFilesWithNodeImports(filePath, fileList);
      }
    } else if (stat.isFile() &&
              (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('node:events') ||
            content.includes('node:stream') ||
            content.includes('node:util') ||
            content.includes('node:path') ||
            content.includes('node:os') ||
            content.includes('node:crypto') ||
            content.includes('node:buffer') ||
            content.includes('node:dns')) {
          // Get relative path from node_modules
          const relativePath = path.relative(nodeModulesPath, filePath);
          fileList.push(relativePath);
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
  }

  return fileList;
}

// Main function
function patchFirebaseAdmin() {
  console.log('🔧 Patching firebase-admin and related packages...');

  let patchedCount = 0;

  // First patch the known files
  for (const file of filesToPatch) {
    if (patchFile(file)) {
      patchedCount++;
    }
  }

  // Then search for additional files with node: imports
  console.log('\n🔍 Searching for additional files with node: imports...');

  // Focus on specific directories to avoid scanning the entire node_modules
  const dirsToSearch = [
    path.join(nodeModulesPath, 'firebase-admin'),
    path.join(nodeModulesPath, '@fastify'),
    path.join(nodeModulesPath, '@grpc'),
    path.join(nodeModulesPath, 'google-auth-library'),
    path.join(nodeModulesPath, 'google-logging-utils'),
    path.join(nodeModulesPath, 'gcp-metadata'),
  ];

  let additionalFiles = [];
  for (const dir of dirsToSearch) {
    if (fs.existsSync(dir)) {
      additionalFiles = additionalFiles.concat(findFilesWithNodeImports(dir));
    }
  }

  // Remove duplicates
  additionalFiles = [...new Set(additionalFiles)];

  console.log(`Found ${additionalFiles.length} additional files with node: imports.`);

  // Patch the additional files
  for (const file of additionalFiles) {
    if (patchFile(file)) {
      patchedCount++;
    }
  }

  console.log(`\n✅ Patching complete! Modified ${patchedCount} files.`);
}

// Run the patch
patchFirebaseAdmin();
