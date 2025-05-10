#!/bin/bash

# Script to update potentially vulnerable dependencies
echo "Updating potentially vulnerable dependencies..."

# Update common vulnerable dependencies
npm install --save postcss@latest
npm install --save-dev postcss@latest
npm install --save-dev eslint@latest eslint-config-next@latest
npm install --save next@latest
npm install --save react@latest react-dom@latest
npm install --save zod@latest
npm install --save stripe@latest @stripe/react-stripe-js@latest @stripe/stripe-js@latest
npm install --save firebase@latest firebase-functions@latest
npm install --save-dev typescript@latest @types/react@latest @types/react-dom@latest

# Update security-related packages
npm install --save-dev crypto-browserify@latest
npm install --save-dev util@latest

# Run audit fix
npm audit fix

echo "Dependencies updated. Please check for any breaking changes."
