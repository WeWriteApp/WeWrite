// Pre-build script to create service account key file
const fs = require('fs');
const path = require('path');

console.log('Running pre-build script...');

// Create minimal service account key
const serviceAccountKey = {
  type: 'service_account',
  project_id: 'wewrite-ccd82'
};

// Ensure the file exists
try {
  const filePath = path.join(process.cwd(), 'service-account-key.json');
  fs.writeFileSync(filePath, JSON.stringify(serviceAccountKey, null, 2));
  console.log('Service account key file created successfully at:', filePath);
} catch (error) {
  console.error('Error creating service account key file:', error);
  // Don't exit with error to allow build to continue
}
