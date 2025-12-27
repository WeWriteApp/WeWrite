import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

/**
 * Admin API to fix page data issues
 * POST /api/admin/fix-page-data - Fix pages with missing titles, usernames, or version data
 *
 * This endpoint addresses the "Untitled" and "by missing username" issues by:
 * 1. Finding pages with missing or default titles/usernames
 * 2. Attempting to recover data from versions
 * 3. Fetching missing usernames from user profiles
 * 4. Creating missing currentVersion references
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Only allow admin users
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    console.log(`🔧 [FIX PAGE DATA] Starting page data fix by admin`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const { dryRun = true, limit = 50 } = await request.json();

    console.log(`🔧 [FIX PAGE DATA] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, Limit: ${limit}`);

    // Get pages with potential issues
    const pagesRef = db.collection(getCollectionName('pages'));
    const pagesSnapshot = await pagesRef.limit(limit).get();

    const results = {
      totalPages: pagesSnapshot.size,
      issuesFound: 0,
      issuesFixed: 0,
      errors: [],
      fixes: []
    };

    for (const pageDoc of pagesSnapshot.docs) {
      const pageId = pageDoc.id;
      const pageData = pageDoc.data();
      
      const issues = [];
      const fixes = [];

      // Check for missing or default title
      if (!pageData.title || pageData.title === 'Untitled' || pageData.title.trim() === '') {
        issues.push('MISSING_TITLE');
      }

      // Check for missing or default username
      if (!pageData.username || pageData.username === 'Anonymous' || pageData.username === 'missing username') {
        issues.push('MISSING_USERNAME');
      }

      // Check for missing currentVersion
      if (!pageData.currentVersion) {
        issues.push('MISSING_CURRENT_VERSION');
      }

      // Check for missing content
      if (!pageData.content) {
        issues.push('MISSING_CONTENT');
      }

      // Check for malformed JSON content (stored as string instead of array)
      if (pageData.content && typeof pageData.content === 'string') {
        try {
          const parsed = JSON.parse(pageData.content);
          if (Array.isArray(parsed)) {
            issues.push('MALFORMED_JSON_CONTENT');
          }
        } catch (e) {
          // If it's a string but not valid JSON, it might be legacy text content
          issues.push('LEGACY_TEXT_CONTENT');
        }
      }

      if (issues.length === 0) {
        continue; // No issues with this page
      }

      results.issuesFound++;
      console.log(`🔧 [FIX PAGE DATA] Page ${pageId} has issues: ${issues.join(', ')}`);

      try {
        // Try to fix issues
        const updateData: any = {};
        let shouldUpdate = false;

        // Fix missing username by fetching from user profile
        if (issues.includes('MISSING_USERNAME') && pageData.userId) {
          try {
            const userRef = db.collection(getCollectionName('users')).doc(pageData.userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData?.username) {
                updateData.username = userData.username;
                fixes.push(`USERNAME: ${userData.username}`);
                shouldUpdate = true;
              }
            }
          } catch (userError) {
            console.warn(`Failed to fetch user data for ${pageData.userId}:`, userError);
          }
        }

        // Fix malformed JSON content
        if (issues.includes('MALFORMED_JSON_CONTENT')) {
          try {
            const parsed = JSON.parse(pageData.content);
            if (Array.isArray(parsed)) {
              updateData.content = parsed; // Store as proper array structure
              fixes.push(`CONTENT: Fixed malformed JSON content (${parsed.length} items)`);
              shouldUpdate = true;
            }
          } catch (e) {
            console.warn(`Failed to parse malformed content for ${pageId}:`, e);
          }
        }

        // Fix legacy text content
        if (issues.includes('LEGACY_TEXT_CONTENT')) {
          // Convert plain text to proper content structure
          updateData.content = [{ type: "paragraph", children: [{ text: pageData.content }] }];
          fixes.push(`CONTENT: Converted legacy text to proper structure`);
          shouldUpdate = true;
        }

        // Fix missing title and content by looking at versions
        if ((issues.includes('MISSING_TITLE') || issues.includes('MISSING_CONTENT') || issues.includes('MISSING_CURRENT_VERSION'))) {
          try {
            const versionsRef = pageDoc.ref.collection('versions');
            const versionsSnapshot = await versionsRef.orderBy('createdAt', 'desc').limit(1).get();
            
            if (!versionsSnapshot.empty) {
              const latestVersion = versionsSnapshot.docs[0];
              const versionData = latestVersion.data();
              
              // Fix missing currentVersion
              if (issues.includes('MISSING_CURRENT_VERSION')) {
                updateData.currentVersion = latestVersion.id;
                fixes.push(`CURRENT_VERSION: ${latestVersion.id}`);
                shouldUpdate = true;
              }
              
              // Fix missing title
              if (issues.includes('MISSING_TITLE') && versionData.title) {
                updateData.title = versionData.title;
                fixes.push(`TITLE: ${versionData.title}`);
                shouldUpdate = true;
              }
              
              // Fix missing content
              if (issues.includes('MISSING_CONTENT') && versionData.content) {
                updateData.content = versionData.content;
                fixes.push(`CONTENT: ${versionData.content.length} chars`);
                shouldUpdate = true;
              }
            }
          } catch (versionError) {
            console.warn(`Failed to fetch versions for ${pageId}:`, versionError);
          }
        }

        // Apply fixes if not in dry run mode
        if (shouldUpdate && !dryRun) {
          await pageDoc.ref.update(updateData);
          results.issuesFixed++;
          console.log(`✅ [FIX PAGE DATA] Fixed page ${pageId}: ${fixes.join(', ')}`);
        }

        results.fixes.push({
          pageId,
          issues,
          fixes: shouldUpdate ? fixes : ['NO_FIXES_POSSIBLE'],
          applied: !dryRun && shouldUpdate
        });

      } catch (error) {
        console.error(`❌ [FIX PAGE DATA] Error fixing page ${pageId}:`, error);
        results.errors.push({
          pageId,
          error: error?.message || 'Unknown error'
        });
      }
    }

    console.log(`🔧 [FIX PAGE DATA] Complete. Found ${results.issuesFound} issues, fixed ${results.issuesFixed}`);

    return NextResponse.json({
      success: true,
      dryRun,
      results
    });

    } catch (error) {
      console.error('Fix page data error:', error);
      return NextResponse.json({
        error: 'Failed to fix page data',
        details: error?.message || 'Unknown error'
      }, { status: 500 });
    }
  }); // End withAdminContext
}
