// This script downloads an image from a URL and saves it to the public/images directory
const https = require('https');
const fs = require('fs');
const path = require('path');

// URL of the image to download
const imageUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1000&auto=format&fit=crop';

// Path where the image will be saved
const imagePath = path.join(__dirname, 'auth-background.jpg');

// Download the image
https.get(imageUrl, (res) => {
  // Check if the response is successful
  if (res.statusCode !== 200) {
    console.error(`Failed to download image: ${res.statusCode} ${res.statusMessage}`);
    return;
  }

  // Create a write stream to save the image
  const fileStream = fs.createWriteStream(imagePath);
  
  // Pipe the response to the file
  res.pipe(fileStream);
  
  // Handle errors during download
  fileStream.on('error', (err) => {
    console.error(`Error writing to file: ${err.message}`);
  });
  
  // Log success when download is complete
  fileStream.on('finish', () => {
    console.log(`Image downloaded and saved to ${imagePath}`);
  });
});
