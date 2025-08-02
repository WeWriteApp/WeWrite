#!/usr/bin/env node

/**
 * Setup HTTPS for local development
 * This script creates self-signed certificates for localhost development
 * to enable Stripe payment testing and resolve security warnings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CERT_DIR = path.join(__dirname, '..', '.certs');
const CERT_FILE = path.join(CERT_DIR, 'localhost.crt');
const KEY_FILE = path.join(CERT_DIR, 'localhost.key');

console.log('🔒 Setting up HTTPS for local development...');

// Create .certs directory if it doesn't exist
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  console.log('📁 Created .certs directory');
}

// Check if certificates already exist
if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
  console.log('✅ SSL certificates already exist');
  console.log('🚀 You can now run: pnpm run dev:https');
  process.exit(0);
}

// Check if OpenSSL is available
try {
  execSync('openssl version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ OpenSSL is not installed or not in PATH');
  console.error('   Please install OpenSSL to generate SSL certificates');
  console.error('   macOS: brew install openssl');
  console.error('   Ubuntu/Debian: sudo apt-get install openssl');
  console.error('   Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
  process.exit(1);
}

console.log('🔑 Generating self-signed SSL certificate...');

try {
  // Generate private key
  execSync(`openssl genrsa -out "${KEY_FILE}" 2048`, { stdio: 'inherit' });
  
  // Generate certificate
  const opensslCommand = `openssl req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -subj "/C=US/ST=Development/L=Localhost/O=WeWrite/OU=Development/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"`;
  
  execSync(opensslCommand, { stdio: 'inherit' });
  
  console.log('✅ SSL certificates generated successfully!');
  console.log(`📄 Certificate: ${CERT_FILE}`);
  console.log(`🔑 Private Key: ${KEY_FILE}`);
  
  // Add .certs to .gitignore if not already there
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.certs')) {
      fs.appendFileSync(gitignorePath, '\n# SSL certificates for local development\n.certs/\n');
      console.log('📝 Added .certs/ to .gitignore');
    }
  }
  
  console.log('');
  console.log('🎉 HTTPS setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: pnpm run dev:https');
  console.log('2. Visit: https://localhost:3000');
  console.log('3. Accept the self-signed certificate warning in your browser');
  console.log('');
  console.log('⚠️  Note: You may need to accept the security warning in your browser');
  console.log('   since this is a self-signed certificate for development only.');
  
} catch (error) {
  console.error('❌ Failed to generate SSL certificates:', error.message);
  process.exit(1);
}
