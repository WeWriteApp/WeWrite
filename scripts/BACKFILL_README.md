# WeWrite Database Backfill Script

This comprehensive backfill script performs data integrity checks and populates missing data across all WeWrite collections.

## Features

- **Data Integrity Checks**: Validates and fixes missing required fields across all collections
- **Analytics Backfill**: Populates global counters, daily/hourly aggregations from existing data
- **Activity Calendar Backfill**: Creates user activity calendars and streak data from page versions
- **Notifications Backfill**: Creates historical notifications for follows and page links
- **Progress Reporting**: Detailed logging and statistics throughout the process
- **Dry Run Mode**: Test the script without making any database changes
- **Batch Processing**: Efficient processing with configurable batch sizes

## Prerequisites

1. Node.js 18+ installed
2. Firebase project credentials
3. Appropriate Firestore permissions

## Setup

1. Navigate to the scripts directory:
   ```bash
   cd scripts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your Firebase configuration:
   ```bash
   # Your Firebase project details
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   # ... etc
   ```

## Usage

### Run Complete Backfill
```bash
# Full backfill (all operations)
npm run backfill

# Dry run (no data changes)
npm run backfill:dry-run

# Verbose logging
npm run backfill:verbose
```

### Run Specific Operations
```bash
# Only data integrity checks
npm run backfill:integrity

# Only analytics backfill
npm run backfill:analytics

# Only activity calendar backfill
npm run backfill:activity

# Only notifications backfill
npm run backfill:notifications
```

### Advanced Options
```bash
# Custom batch size
node comprehensive-backfill.js --batch-size=50

# Multiple options
node comprehensive-backfill.js --dry-run --verbose --batch-size=200
```

## What the Script Does

### 1. Data Integrity Checks (`--integrity-only`)
- Ensures all pages have required fields (deleted, createdAt, lastModified, etc.)
- Populates missing usernames from user documents
- Adds missing fundraising fields
- Fixes user profile fields
- Validates page versions
- Removes orphaned records

### 2. Analytics Backfill (`--analytics-only`)
- Calculates global counters (total pages, active pages, etc.)
- Creates daily aggregations from page creation data
- Generates hourly aggregations for recent activity
- Updates analytics collections with historical data

### 3. Activity Calendar Backfill (`--activity-only`)
- Analyzes page versions to determine user activity dates
- Creates activity calendar data for all users
- Calculates current and longest streaks
- Updates user streak records

### 4. Notifications Backfill (`--notifications-only`)
- Creates notifications for historical page follows
- Generates notifications for page links
- Marks backfilled notifications as read
- Avoids duplicate notifications

## Output

The script provides detailed logging including:
- Progress updates for each operation
- Statistics on records processed and created
- Error reporting with context
- Final summary with execution time

Example output:
```
2024-01-15T10:30:00.000Z ℹ️  🚀 Starting WeWrite Comprehensive Database Backfill
2024-01-15T10:30:00.100Z ℹ️  🔍 Starting data integrity checks...
2024-01-15T10:30:05.200Z ✅ Data integrity checks completed. Fixed 45 pages, 12 users, 8 versions
2024-01-15T10:30:05.300Z ℹ️  📊 Starting analytics backfill...
...
2024-01-15T10:32:30.500Z ✅ Backfill completed successfully!
2024-01-15T10:32:30.600Z ℹ️  Total execution time: 150 seconds
```

## Safety Features

- **Dry Run Mode**: Test without making changes
- **Batch Processing**: Prevents memory issues with large datasets
- **Error Handling**: Continues processing even if individual records fail
- **Validation**: Checks for existing data before creating duplicates
- **Logging**: Comprehensive audit trail of all operations

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure your Firebase credentials have Firestore read/write access
2. **Memory Issues**: Reduce batch size with `--batch-size=50`
3. **Network Timeouts**: Run specific operations separately instead of full backfill
4. **Duplicate Data**: The script checks for existing data to prevent duplicates

### Getting Help

1. Run with `--verbose` for detailed logging
2. Use `--dry-run` to see what would be changed
3. Check the error messages for specific collection/document issues
4. Review the statistics output to understand what was processed

## Performance

- Typical execution time: 2-5 minutes for small databases, 10-30 minutes for large ones
- Memory usage: ~100-500MB depending on database size
- Network usage: Optimized with batch operations and field selection

## Maintenance

This script is designed to be run periodically or after major data migrations. It's safe to run multiple times as it checks for existing data before making changes.
