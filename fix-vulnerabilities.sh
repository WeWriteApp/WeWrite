#!/bin/bash

# Script to fix vulnerabilities with force flag
echo "Fixing vulnerabilities with force flag..."

# Run audit fix with force flag
npm audit fix --force

# Check functions directory
echo "Fixing vulnerabilities in functions directory..."
cd functions
npm audit fix --force --legacy-peer-deps

echo "Vulnerabilities fixed. Please check for any breaking changes."
