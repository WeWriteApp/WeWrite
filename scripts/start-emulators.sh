#!/bin/bash

# Start Firebase Emulators for WeWrite Development
# This script starts the Firebase emulators needed for local development

echo "🔥 Starting Firebase Emulators for WeWrite Development..."

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing firebase-tools..."
    npm install -g firebase-tools
fi

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ firebase.json not found. Please run this script from the project root."
    exit 1
fi

# Start emulators
echo "🚀 Starting Firebase emulators..."
echo "   - Auth: http://localhost:9099"
echo "   - Firestore: http://localhost:8080"
echo "   - Database: http://localhost:9000"
echo "   - Storage: http://localhost:9199"
echo "   - UI: http://localhost:4000"
echo ""

# Start emulators with import/export for data persistence
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
