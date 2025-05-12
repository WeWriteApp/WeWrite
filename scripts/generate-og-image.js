const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create the images directory if it doesn't exist
const imagesDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Create a canvas for the OG image
const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Fill the background with a gradient
const gradient = ctx.createLinearGradient(0, 0, 0, height);
gradient.addColorStop(0, '#000000');
gradient.addColorStop(1, '#111827');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Add the WeWrite logo/text
ctx.font = 'bold 100px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Create a gradient for the text
const textGradient = ctx.createLinearGradient(width/2 - 200, height/2 - 50, width/2 + 200, height/2 + 50);
textGradient.addColorStop(0, '#60A5FA');
textGradient.addColorStop(1, '#ffffff');
ctx.fillStyle = textGradient;

// Draw the main title
ctx.fillText('WeWrite', width/2, height/2 - 50);

// Add the tagline
ctx.font = '36px Arial';
ctx.fillStyle = 'white';
ctx.fillText('Collaborative Writing Platform', width/2, height/2 + 50);

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(imagesDir, 'og-image.png'), buffer);

console.log('OG image generated successfully at public/images/og-image.png');
