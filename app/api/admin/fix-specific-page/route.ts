import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { verifyAdminAccess, createAdminUnauthorizedResponse } from '../../../utils/adminSecurity';

/**
 * Admin API to fix a specific page with malformed content
 * POST /api/admin/fix-specific-page - Fix a specific page by ID
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Use centralized admin verification with audit logging
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }

    console.log(`🔧 [FIX SPECIFIC PAGE] Starting page fix for admin: ${adminAuth.userId}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const { pageId, dryRun = true } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    console.log(`🔧 [FIX SPECIFIC PAGE] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, Page: ${pageId}`);

    // Get the specific page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const pageData = pageDoc.data();
    const result = {
      pageId,
      currentContent: {
        type: typeof pageData?.content,
        sample: typeof pageData?.content === 'string' ? 
          pageData.content.substring(0, 200) : 
          JSON.stringify(pageData?.content || null).substring(0, 200)
      },
      issues: [],
      fixes: [],
      applied: false
    };

    // Check for malformed JSON content
    if (typeof pageData?.content === 'string') {
      try {
        const parsed = JSON.parse(pageData.content);
        if (Array.isArray(parsed)) {
          result.issues.push('MALFORMED_JSON_CONTENT');
          result.fixes.push(`Convert JSON string to proper array structure (${parsed.length} items)`);
          
          if (!dryRun) {
            await pageRef.update({
              content: parsed,
              lastModified: new Date().toISOString(),
              fixedAt: new Date().toISOString(),
              fixedBy: 'admin-fix-specific-page'
            });
            result.applied = true;
            console.log(`✅ [FIX SPECIFIC PAGE] Fixed malformed JSON content for ${pageId}`);
          }
        } else {
          result.issues.push('NON_ARRAY_JSON_CONTENT');
          const fixedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
          result.fixes.push('Convert non-array JSON to paragraph structure');
          
          if (!dryRun) {
            await pageRef.update({
              content: fixedContent,
              lastModified: new Date().toISOString(),
              fixedAt: new Date().toISOString(),
              fixedBy: 'admin-fix-specific-page'
            });
            result.applied = true;
            console.log(`✅ [FIX SPECIFIC PAGE] Fixed non-array JSON content for ${pageId}`);
          }
        }
      } catch (e) {
        result.issues.push('LEGACY_TEXT_CONTENT');
        const fixedContent = [{ type: "paragraph", children: [{ text: pageData.content }] }];
        result.fixes.push('Convert legacy text to paragraph structure');
        
        if (!dryRun) {
          await pageRef.update({
            content: fixedContent,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'admin-fix-specific-page'
          });
          result.applied = true;
          console.log(`✅ [FIX SPECIFIC PAGE] Fixed legacy text content for ${pageId}`);
        }
      }
    } else if (Array.isArray(pageData?.content)) {
      result.issues.push('CONTENT_ALREADY_PROPER');
      result.fixes.push('No fixes needed - content is already in proper array format');
    } else {
      result.issues.push('UNEXPECTED_CONTENT_FORMAT');
      result.fixes.push('Content has unexpected format: ' + typeof pageData?.content);
    }

    console.log(`🔧 [FIX SPECIFIC PAGE] Complete for ${pageId}. Issues: ${result.issues.length}, Applied: ${result.applied}`);

    return NextResponse.json({
      success: true,
      dryRun,
      result
    });

  } catch (error) {
    console.error('Fix specific page error:', error);
    return NextResponse.json({
      error: 'Failed to fix specific page',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
