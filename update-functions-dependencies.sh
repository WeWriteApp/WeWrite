#!/bin/bash

# Script to update potentially vulnerable dependencies in the functions directory
echo "Updating potentially vulnerable dependencies in functions directory..."

# Change to the functions directory
cd functions

# Update common vulnerable dependencies with legacy-peer-deps to resolve conflicts
npm install --save @google-cloud/bigquery@latest --legacy-peer-deps
npm install --save firebase-admin@12.7.0 --legacy-peer-deps
npm install --save firebase-functions@5.1.1 --legacy-peer-deps
npm install --save-dev firebase-functions-test@3.3.0 --legacy-peer-deps

# Run audit fix with legacy-peer-deps
npm audit fix --legacy-peer-deps

echo "Functions dependencies updated. Please check for any breaking changes."
