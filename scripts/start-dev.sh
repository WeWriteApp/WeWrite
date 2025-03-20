#!/bin/bash

# Kill any existing processes on port 3000
npx kill-port 3000 2>/dev/null || true

# Wait a moment for the port to be fully released
sleep 1

# Start the development server
exec next dev -p 3000 