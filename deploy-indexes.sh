#!/bin/bash

# Deploy Firestore indexes
echo "Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "Indexes deployed successfully!"
