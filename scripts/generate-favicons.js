#!/usr/bin/env node

/**
 * Favicon Generation Script
 *
 * Generates all required favicon formats from the source SVG
 * This script creates favicons for different browsers and devices
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Favicon configurations
const FAVICON_CONFIGS = [
  // Standard favicons
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },

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
 * Main function to generate all favicons
 */
async function generateFavicons() {
  console.log('🎨 Generating WeWrite favicons...\n');

  const sourceFile = 'public/icons/source/Favicon.svg';
  const iconsDir = 'public/icons';
  const publicDir = 'public';

  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.error('❌ Source file not found:', sourceFile);
    return;
  }

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  let generated = 0;

  try {
    // Read the source SVG
    const svgBuffer = fs.readFileSync(sourceFile);

    // Generate PNG files
    for (const config of FAVICON_CONFIGS) {
      const { name, size, height } = config;
      const outputPath = path.join(iconsDir, name);

      const actualWidth = size;
      const actualHeight = height || size;

      await sharp(svgBuffer)
        .resize(actualWidth, actualHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          quality: 100,
          compressionLevel: 6
        })
        .toFile(outputPath);

      console.log(`✅ Generated: ${name} (${actualWidth}x${actualHeight})`);
      generated++;
    }

    // Generate favicon.ico (using 32x32 as base)
    const icoPath = path.join(publicDir, 'favicon.ico');
    await sharp(svgBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({
        quality: 100,
        compressionLevel: 6
      })
      .toFile(icoPath);

    console.log('✅ Generated: favicon.ico');
    generated++;

    console.log(`\n🎉 Successfully generated ${generated} favicon files!`);

  } catch (error) {
    console.error('❌ Error generating favicons:', error);
    console.error('Error details:', error.message);
  }
}

/**
 * Update manifest.json with new icon references
 */
function updateManifest() {
  const manifestPath = 'app/manifest.json';

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

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ Updated manifest.json with new icon references');
  } catch (error) {
    console.error('❌ Failed to update manifest.json:', error.message);
  }
}

// Run the script
async function main() {
  await generateFavicons();
  updateManifest();
}

main().catch(console.error);
