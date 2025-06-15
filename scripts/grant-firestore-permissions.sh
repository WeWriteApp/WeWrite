#!/bin/bash

# Script to grant Firestore permissions to the bigquery service account
# This fixes the PERMISSION_DENIED error in subscription creation

PROJECT_ID="wewrite-ccd82"
SERVICE_ACCOUNT="bigquery-sa@wewrite-ccd82.iam.gserviceaccount.com"

echo "🔧 Granting Firestore permissions to service account..."
echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

# Grant Cloud Datastore User role (allows read/write to Firestore)
echo "📝 Granting Cloud Datastore User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/datastore.user"

if [ $? -eq 0 ]; then
    echo "✅ Successfully granted Cloud Datastore User role"
else
    echo "❌ Failed to grant Cloud Datastore User role"
    exit 1
fi

# Grant Firebase Admin SDK Administrator Service Agent role (for full Firebase access)
echo "📝 Granting Firebase Admin SDK Administrator Service Agent role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/firebase.sdkAdminServiceAgent"

if [ $? -eq 0 ]; then
    echo "✅ Successfully granted Firebase Admin SDK Administrator Service Agent role"
else
    echo "❌ Failed to grant Firebase Admin SDK Administrator Service Agent role"
    echo "ℹ️  This role might not exist in your project, but Cloud Datastore User should be sufficient"
fi

# Grant Firebase Rules Admin role (for security rules access if needed)
echo "📝 Granting Firebase Rules Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/firebaserules.admin"

if [ $? -eq 0 ]; then
    echo "✅ Successfully granted Firebase Rules Admin role"
else
    echo "❌ Failed to grant Firebase Rules Admin role"
    echo "ℹ️  This is optional for basic Firestore operations"
fi

echo ""
echo "🎉 Permission granting completed!"
echo ""
echo "📋 Current IAM policy for the service account:"
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:$SERVICE_ACCOUNT"

echo ""
echo "🔄 Please restart your development server to pick up the new permissions."
