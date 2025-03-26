# Setting Up Firebase Indexes for Username History

This document explains how to set up the required Firebase indexes for the username history feature.

## Option 1: Using the Firebase Console (Manual)

1. Go to the Firebase Console: https://console.firebase.google.com/
2. Select your project
3. Navigate to Firestore Database > Indexes
4. Click "Add Index"
5. Set up a composite index with the following configuration:
   - Collection ID: `usernameHistory`
   - Fields to index:
     - `userId` (Ascending)
     - `changedAt` (Descending)
   - Query scope: Collection

## Option 2: Using the Firebase MCP Script (Automated)

We've set up a script that can automatically create the required indexes using the Firebase MCP package.

### Prerequisites

1. **Service Account Key**: You need a Firebase service account key with Firestore admin permissions.

   To create a service account key:
   - Go to the Firebase Console
   - Navigate to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `service-account-key.json` in the root of this project

2. **Environment Variable**: Set your Firebase project ID as an environment variable:
   ```
   export FIREBASE_PROJECT_ID=your-project-id
   ```

### Running the Script

Once you have the service account key file in place, run:

```bash
node scripts/create-indexes.js
```

This will create the required composite index for the username history feature.

## Verifying Indexes

After creating the index (either manually or via script), you can verify it's working by:

1. Going to a user profile page
2. Clicking on the "About" tab
3. Checking that the username history is displayed correctly

If the index is still being built, you might see a message indicating that the index is being created. This process typically takes a few minutes to complete.
