# WeWrite Development Scripts

This directory contains utility scripts for WeWrite development and maintenance.

## Prerequisites

- Node.js 16 or higher
- Firebase account with admin access to the WeWrite project (for Firebase-related scripts)

## Setup

1. Navigate to the scripts directory:
   ```
   cd scripts
   ```

2. Install dependencies (if needed for specific scripts):
   ```
   npm install
   ```

## Available Scripts

### Development Utilities
- `start-dev.sh` - Start development server
- `start-turbo.sh` - Start development server with Turbo
- `ensure-port-3000.sh` - Ensure port 3000 is available

### Database Maintenance
- `create-firestore-index.js` - Create Firestore indexes
- `create-indexes.js` - Create database indexes
- `migrate-daily-notes.js` - Migrate daily notes from YYYY-MM-DD titles to customDate field

### Utilities
- `seo-audit.js` - SEO audit tool
- `generate-placeholder-images.js` - Generate placeholder images

## Environment Variables

For Firebase-related scripts, ensure you have the necessary environment variables set in your `.env.local` file at the root of the project:

- `FIREBASE_PROJECT_ID` or `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- Or `GOOGLE_CLOUD_KEY_JSON` (base64-encoded service account JSON)

## Daily Notes Migration

The `migrate-daily-notes.js` script migrates existing daily notes from YYYY-MM-DD titles to "Daily note" titles with customDate field.

### Usage
```bash
# Dry run (recommended first)
node scripts/migrate-daily-notes.js --dry-run

# Live migration
node scripts/migrate-daily-notes.js

# Custom batch size
node scripts/migrate-daily-notes.js --batch-size=25
```

### Safety Features
- **Dry run mode**: Test without making changes
- **Batch processing**: Configurable batch sizes
- **Idempotent**: Safe to run multiple times
- **Validation**: Skips invalid dates and already migrated pages

## Notes

- One-time migration scripts have been removed after successful execution to keep the codebase clean
- All remaining scripts are utilities that may be used multiple times during development
- Always backup your database before running migration scripts
