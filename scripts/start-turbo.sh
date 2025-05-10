#!/bin/bash

# Kill any existing processes on port 3000
echo "Cleaning up port 3000..."
npx kill-port 3000 2>/dev/null || true

# Wait a moment for the port to be fully released
sleep 1

# Copy the Turbopack configuration to next.config.js temporarily
cp next.turbo.js next.config.js.bak
cp next.turbo.js next.config.js

# Start the development server with Turbopack
echo "Starting development server with Turbopack..."
next dev --turbopack -p 3000

# Restore the original next.config.js
mv next.config.js.bak next.config.js
