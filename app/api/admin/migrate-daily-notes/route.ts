import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../firebase/admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 */
function isExactDateFormat(title: string): boolean {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
}

/**
 * Validate that a date string is a valid date
 */
function isValidDate(dateString: string): boolean {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return !isNaN(date.getTime()) && 
           date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  } catch (error) {
    return false;
  }
}

interface MigrationResult {
  success: boolean;
  totalScanned: number;
  dailyNotesFound: number;
  migrated: number;
  errors: string[];
  dryRun: boolean;
}

/**
 * Find and migrate daily notes system-wide
 */
async function migrateDailyNotes(dryRun: boolean = true): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    totalScanned: 0,
    dailyNotesFound: 0,
    migrated: 0,
    errors: [],
    dryRun
  };

  try {
    console.log(`🔍 Starting ${dryRun ? 'dry run' : 'migration'} of daily notes...`);

    // Get all pages from Firestore
    const pagesSnapshot = await adminDb.collection('pages').get();
    result.totalScanned = pagesSnapshot.size;

    console.log(`📋 Scanning ${result.totalScanned} pages...`);

    const dailyNotesToMigrate: any[] = [];

    // Find all daily notes that need migration
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if this is a daily note (exact YYYY-MM-DD format)
      if (data.title && isExactDateFormat(data.title) && isValidDate(data.title)) {
        // Skip if already migrated (has customDate field)
        if (!data.customDate) {
          dailyNotesToMigrate.push({
            id: doc.id,
            title: data.title,
            userId: data.userId,
            username: data.username || 'Unknown'
          });
        }
      }
    });

    result.dailyNotesFound = dailyNotesToMigrate.length;
    console.log(`📋 Found ${result.dailyNotesFound} daily notes to migrate`);

    if (dailyNotesToMigrate.length === 0) {
      result.success = true;
      console.log('✅ No daily notes found that need migration');
      return result;
    }

    if (dryRun) {
      console.log('📋 [DRY RUN] Would migrate the following daily notes:');
      dailyNotesToMigrate.forEach(note => {
        console.log(`  - Page ${note.id}: "${note.title}" → "Daily note" (customDate: ${note.title}) [User: ${note.username}]`);
      });
      result.migrated = dailyNotesToMigrate.length;
      result.success = true;
      return result;
    }

    // Perform actual migration
    console.log('🚀 Starting migration...');

    // Use batched writes for better performance
    const batchSize = 10;
    let migratedCount = 0;

    for (let i = 0; i < dailyNotesToMigrate.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchNotes = dailyNotesToMigrate.slice(i, i + batchSize);

      batchNotes.forEach(note => {
        const pageRef = adminDb.collection('pages').doc(note.id);
        batch.update(pageRef, {
          title: 'Daily note',
          customDate: note.title, // Original YYYY-MM-DD title becomes customDate
          lastModified: new Date()
        });
      });

      try {
        await batch.commit();
        migratedCount += batchNotes.length;

        console.log(`✅ Migrated batch ${Math.floor(i / batchSize) + 1}: ${batchNotes.length} notes`);
        batchNotes.forEach(note => {
          console.log(`  ✏️  Updated page ${note.id}: "${note.title}" → "Daily note" (customDate: ${note.title})`);
        });
      } catch (error) {
        const errorMsg = `Failed to migrate batch starting at index ${i}: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.migrated = migratedCount;
    result.success = result.errors.length === 0;

    console.log(`🎉 Migration completed! Migrated ${migratedCount}/${dailyNotesToMigrate.length} daily notes`);

    return result;
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
    return result;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== 'jamiegray2234@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dryRun = true } = await request.json();

    const result = await migrateDailyNotes(dryRun);

    return NextResponse.json({
      success: result.success,
      message: `${dryRun ? 'Dry run completed' : 'Migration completed'}`,
      data: result
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ready',
    endpoint: 'daily-notes-migration'
  });
}
