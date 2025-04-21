const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create the images directory if it doesn't exist
const imagesDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// List of feature images to generate
const features = [
  'feature-fundraiser',
  'feature-donations',
  'feature-no-ads',
  'feature-collaboration',
  'feature-map-view',
  'feature-calendar',
  'feature-version-history',
  'feature-reading',
  'feature-line-modes'
];

// Generate a placeholder image for each feature
features.forEach((feature, index) => {
  // Create a canvas with a 16:9 aspect ratio
  const width = 600;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill the background with a gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${index * 40}, 70%, 80%)`);
  gradient.addColorStop(1, `hsl(${index * 40 + 20}, 70%, 60%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add a grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  
  // Draw vertical lines
  for (let x = 0; x < width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Add feature name as text
  const featureName = feature.replace('feature-', '').split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(featureName, width / 2, height / 2);

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(imagesDir, `${feature}.png`), buffer);
  
  console.log(`Generated ${feature}.png`);
});

console.log('All placeholder images generated successfully!');
