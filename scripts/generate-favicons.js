#!/usr/bin/env node

/**
 * Favicon Generation Script
 * 
 * Generates all required favicon formats from the source SVG
 * This script creates favicons for different browsers and devices
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Favicon configurations
const FAVICON_CONFIGS = [
  // Standard favicons
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon.ico', size: 32, format: 'ico' },
  
  // Apple touch icons
  { name: 'apple-touch-icon.png', size: 180 },
  
  // PWA icons
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  
  // Microsoft tiles
  { name: 'mstile-70x70.png', size: 70 },
  { name: 'mstile-144x144.png', size: 144 },
  { name: 'mstile-150x150.png', size: 150 },
  { name: 'mstile-310x150.png', size: 310, height: 150 },
  { name: 'mstile-310x310.png', size: 310 },
];

/**
 * Generate SVG content for different sizes
 */
function generateSVGContent(size, height = null) {
  const actualHeight = height || size;
  
  return `<svg width="${size}" height="${actualHeight}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle -->
  <circle cx="16" cy="16" r="16" fill="#1a1a1a"/>
  
  <!-- WeWrite "W" logo -->
  <path d="M6 8 L10 24 L13 24 L16 12 L19 24 L22 24 L26 8 L23 8 L20.5 20 L17.5 8 L14.5 8 L11.5 20 L9 8 Z" fill="white"/>
  
  <!-- Subtle accent dot -->
  <circle cx="26" cy="10" r="1.5" fill="#4ade80"/>
</svg>`;
}

/**
 * Generate ICO content (simplified - just use PNG data)
 */
function generateICOContent() {
  // For simplicity, we'll create a basic ICO structure
  // In a real implementation, you'd use a proper ICO library
  return generateSVGContent(32);
}

/**
 * Main function to generate all favicons
 */
function generateFavicons() {
  console.log('🎨 Generating WeWrite favicons...\n');
  
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  const publicDir = path.join(__dirname, '..', 'public');
  
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  let generated = 0;
  
  FAVICON_CONFIGS.forEach(config => {
    try {
      const { name, size, height, format } = config;
      const outputPath = path.join(iconsDir, name);
      
      let content;
      if (format === 'ico') {
        // For ICO files, we'll save as SVG for now
        // In production, you'd convert to actual ICO format
        content = generateICOContent();
        const icoPath = path.join(publicDir, 'favicon.ico');
        fs.writeFileSync(icoPath, content);
        console.log(`✅ Generated: favicon.ico`);
      } else {
        // Generate SVG content for PNG files
        content = generateSVGContent(size, height);
        fs.writeFileSync(outputPath, content);
        console.log(`✅ Generated: ${name} (${size}x${height || size})`);
      }
      
      generated++;
    } catch (error) {
      console.error(`❌ Failed to generate ${config.name}:`, error.message);
    }
  });
  
  console.log(`\n🎉 Successfully generated ${generated} favicon files!`);
  console.log('\n📝 Next steps:');
  console.log('   1. Convert SVG files to PNG using an image converter');
  console.log('   2. Convert favicon.ico to proper ICO format');
  console.log('   3. Test favicons in different browsers');
  console.log('   4. Update manifest.json if needed');
}

/**
 * Update manifest.json with new icon references
 */
function updateManifest() {
  const manifestPath = path.join(__dirname, '..', 'app', 'manifest.json');
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Update icons array
    manifest.icons = [
      {
        "src": "/icons/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/icons/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ];
    
    // Update theme colors to match new branding
    manifest.background_color = "#1a1a1a";
    manifest.theme_color = "#1a1a1a";
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ Updated manifest.json with new icon references');
  } catch (error) {
    console.error('❌ Failed to update manifest.json:', error.message);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFavicons();
  updateManifest();
}

export { generateFavicons, updateManifest };
