# WeWrite Mock Data Cleanup Scripts

This directory contains scripts to clean up mock/placeholder data from the WeWrite application.

## Prerequisites

- Node.js 16 or higher
- Firebase account with admin access to the WeWrite project

## Setup

1. Navigate to the scripts directory:
   ```
   cd scripts
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Cleanup Script

1. Make sure you have the necessary environment variables set in your `.env.local` file at the root of the project.

2. Run the cleanup script:
   ```
   npm run cleanup
   ```

3. When prompted, enter your Firebase admin email and password.

4. The script will:
   - Remove known mock pages
   - Remove pages created by mock users
   - Remove mock user accounts
   - Remove test groups and their associated content
   - Clean up any other fake/sample data

## What Gets Removed

The script removes:

1. Pages with IDs matching known mock page IDs
2. Pages created by users with IDs matching known mock user IDs
3. Pages created by users with usernames matching known mock usernames
4. User accounts with IDs matching known mock user IDs
5. Groups created by mock users
6. Groups with names or descriptions containing "test", "mock", or "sample"

## Manual Verification

After running the script, it's recommended to manually verify that:

1. All mock data has been removed
2. Real user data has not been affected
3. The application functions correctly

## Code Changes

In addition to running this script, the following code changes have been made:

1. Removed sample activity generation
2. Removed mock trending pages
3. Removed client-side search mock data
4. Removed mock user creation in API routes
5. Disabled fallback search results

These changes ensure that only real user-generated content is displayed in the application.
