import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

/**
 * Backfill API for Leaderboard Data
 *
 * This endpoint ensures all collections have proper createdAt Timestamps
 * so the leaderboard queries work correctly.
 *
 * Collections backfilled:
 * - pages: createdAt (string -> Timestamp)
 * - backlinks: createdAt (string -> Timestamp)
 * - usdAllocations: createdAt (string -> Timestamp)
 * - pageViews: date field (ensure exists)
 *
 * POST /api/admin/backfill-leaderboard?collection=all&env=production
 *
 * Query params:
 * - collection: 'pages' | 'backlinks' | 'allocations' | 'pageViews' | 'all'
 * - env: 'development' | 'production' (defaults to current environment)
 * - dryRun: 'true' to just count without updating
 */

type CollectionType = 'pages' | 'backlinks' | 'allocations' | 'pageViews' | 'all';

export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    const { searchParams } = new URL(request.url);
    const collection = (searchParams.get('collection') || 'all') as CollectionType;
    const envOverride = searchParams.get('env');
    const dryRun = searchParams.get('dryRun') === 'true';

    // Simple auth check - require a secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.ADMIN_API_SECRET || 'wewrite-backfill-2024';
    
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Determine which environment to backfill
    const currentEnv = getEnvironmentType();
    const targetEnv = envOverride || currentEnv;
    
    // For production, use production collection names
    const getTargetCollection = (baseName: string) => {
      if (targetEnv === 'production') {
        return baseName; // Production uses base names
      }
      return `DEV_${baseName}`; // Dev uses DEV_ prefix (uppercase)
    };

    const results: Record<string, any> = {
      environment: targetEnv,
      dryRun,
      collections: {}
    };


    // Backfill pages
    if (collection === 'pages' || collection === 'all') {
      results.collections.pages = await backfillTimestamps(
        db,
        getTargetCollection('pages'),
        'createdAt',
        dryRun
      );
    }

    // Backfill backlinks
    if (collection === 'backlinks' || collection === 'all') {
      results.collections.backlinks = await backfillTimestamps(
        db,
        getTargetCollection('backlinks'),
        'createdAt',
        dryRun
      );
    }

    // Backfill allocations
    if (collection === 'allocations' || collection === 'all') {
      results.collections.usdAllocations = await backfillTimestamps(
        db,
        getTargetCollection('usdAllocations'),
        'createdAt',
        dryRun
      );
    }

    // Check pageViews
    if (collection === 'pageViews' || collection === 'all') {
      results.collections.pageViews = await checkPageViews(
        db,
        getTargetCollection('pageViews'),
        dryRun
      );
    }


    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run complete - no changes made' : 'Backfill complete',
      results
    });

    } catch (error) {
      console.error('Backfill error:', error);
      return NextResponse.json({
        error: 'Backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }); // End withAdminContext
}

async function backfillTimestamps(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  timestampField: string,
  dryRun: boolean
): Promise<{ total: number; needsUpdate: number; updated: number; errors: number; sample: any[] }> {
  const admin = await import('firebase-admin');
  
  
  const snapshot = await db.collection(collectionName).get();
  
  let needsUpdate = 0;
  let updated = 0;
  let errors = 0;
  const sample: any[] = [];
  
  let batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 500;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentValue = data[timestampField];
    
    // Check if it needs conversion
    let needsConversion = false;
    let newTimestamp: FirebaseFirestore.Timestamp | null = null;
    
    if (!currentValue) {
      // No timestamp at all - use document creation time or now
      needsConversion = true;
      // Try to extract from other fields
      const fallbackDate = data.timestamp || data.updatedAt || data.date;
      if (fallbackDate) {
        if (typeof fallbackDate === 'string') {
          newTimestamp = admin.firestore.Timestamp.fromDate(new Date(fallbackDate));
        } else if (fallbackDate._seconds !== undefined) {
          // Already a timestamp
          newTimestamp = fallbackDate;
          needsConversion = false;
        }
      } else {
        // Default to now
        newTimestamp = admin.firestore.Timestamp.now();
      }
    } else if (typeof currentValue === 'string') {
      // String date - convert to Timestamp
      needsConversion = true;
      try {
        const date = new Date(currentValue);
        if (!isNaN(date.getTime())) {
          newTimestamp = admin.firestore.Timestamp.fromDate(date);
        }
      } catch (e) {
        console.error(`Invalid date string in ${doc.id}: ${currentValue}`);
        errors++;
        continue;
      }
    } else if (currentValue._seconds !== undefined) {
      // Already a proper Timestamp
      needsConversion = false;
    } else if (currentValue instanceof Date) {
      // Date object - convert to Timestamp
      needsConversion = true;
      newTimestamp = admin.firestore.Timestamp.fromDate(currentValue);
    }
    
    if (needsConversion && newTimestamp) {
      needsUpdate++;
      
      if (sample.length < 5) {
        sample.push({
          docId: doc.id,
          oldValue: currentValue,
          newValue: newTimestamp.toDate().toISOString()
        });
      }
      
      if (!dryRun) {
        batch.update(doc.ref, { [timestampField]: newTimestamp });
        batchCount++;
        
        // Commit batch when full
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          updated += batchCount;
          // Create a new batch for the next set of updates
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
  }
  
  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    updated += batchCount;
  }
  
  return {
    total: snapshot.docs.length,
    needsUpdate,
    updated: dryRun ? 0 : needsUpdate,
    errors,
    sample
  };
}

async function checkPageViews(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  dryRun: boolean
): Promise<{ total: number; withDate: number; withoutDate: number; sample: any[] }> {
  
  const snapshot = await db.collection(collectionName).get();
  
  let withDate = 0;
  let withoutDate = 0;
  const sample: any[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    if (data.date) {
      withDate++;
    } else {
      withoutDate++;
      if (sample.length < 5) {
        sample.push({
          docId: doc.id,
          pageId: data.pageId,
          totalViews: data.totalViews
        });
      }
    }
  }
  
  return {
    total: snapshot.docs.length,
    withDate,
    withoutDate,
    sample
  };
}

// GET endpoint for status check
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    return NextResponse.json({
    message: 'Leaderboard Backfill API',
    usage: 'POST /api/admin/backfill-leaderboard?collection=all&env=production',
    params: {
      collection: 'pages | backlinks | allocations | pageViews | all',
      env: 'development | production',
      dryRun: 'true | false (default false)'
    },
    auth: 'Authorization: Bearer <ADMIN_API_SECRET>'
    });
  }); // End withAdminContext
}
