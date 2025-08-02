#!/usr/bin/env node

/**
 * Start Next.js development server with HTTPS
 * This enables Stripe payment testing and resolves security warnings
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Paths to SSL certificates
const CERT_DIR = path.join(__dirname, '..', '.certs');
const CERT_FILE = path.join(CERT_DIR, 'localhost.crt');
const KEY_FILE = path.join(CERT_DIR, 'localhost.key');

console.log('🔒 Starting HTTPS development server...');

// Check if SSL certificates exist
if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
  console.error('❌ SSL certificates not found!');
  console.error('   Run: node scripts/setup-https-dev.js');
  console.error('   Then try again: pnpm run dev:https');
  process.exit(1);
}

// Read SSL certificates
let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
  };
  console.log('✅ SSL certificates loaded');
} catch (error) {
  console.error('❌ Failed to read SSL certificates:', error.message);
  console.error('   Try regenerating: node scripts/setup-https-dev.js');
  process.exit(1);
}

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTPS server
  const server = https.createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Handle server errors
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
      console.error('   Try: npx kill-port 3000');
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log('');
    console.log('🎉 HTTPS development server ready!');
    console.log('');
    console.log(`   ▲ Next.js ${require('next/package.json').version}`);
    console.log(`   - Local:    https://${hostname}:${port}`);
    console.log(`   - Network:  https://192.168.1.228:${port}`);
    console.log('');
    console.log('✅ Stripe payments will work with HTTPS');
    console.log('⚠️  Accept the certificate warning in your browser');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down HTTPS server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 Shutting down HTTPS server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});
