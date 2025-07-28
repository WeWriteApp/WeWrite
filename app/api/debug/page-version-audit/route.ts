import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    
    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required'
      }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    console.log(`🔍 Auditing page and versions for: ${pageId}`);

    const audit = {
      pageId,
      collections: {
        // Check production collections
        production: {
          page: null as any,
          versions: [] as any[]
        },
        // Check dev collections  
        development: {
          page: null as any,
          versions: [] as any[]
        }
      }
    };

    // Check production page
    try {
      const prodPageDoc = await db.collection('pages').doc(pageId).get();
      if (prodPageDoc.exists) {
        const data = prodPageDoc.data();
        audit.collections.production.page = {
          exists: true,
          title: data?.title,
          content: data?.content ? `${data.content.length} chars` : 'null/empty',
          hasContent: !!data?.content,
          createdAt: data?.createdAt,
          lastModified: data?.lastModified
        };

        // Check production versions
        const prodVersionsSnapshot = await db
          .collection('pages')
          .doc(pageId)
          .collection('versions')
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();

        audit.collections.production.versions = prodVersionsSnapshot.docs.map(doc => ({
          id: doc.id,
          content: doc.data().content ? `${doc.data().content.length} chars` : 'null/empty',
          hasContent: !!doc.data().content,
          createdAt: doc.data().createdAt,
          type: doc.data().type
        }));
      } else {
        audit.collections.production.page = { exists: false };
      }
    } catch (error) {
      audit.collections.production.page = { error: error.message };
    }

    // Check dev page
    try {
      const devPageDoc = await db.collection('DEV_pages').doc(pageId).get();
      if (devPageDoc.exists) {
        const data = devPageDoc.data();
        audit.collections.development.page = {
          exists: true,
          title: data?.title,
          content: data?.content ? `${data.content.length} chars` : 'null/empty',
          hasContent: !!data?.content,
          createdAt: data?.createdAt,
          lastModified: data?.lastModified
        };

        // Check dev versions
        const devVersionsSnapshot = await db
          .collection('DEV_pages')
          .doc(pageId)
          .collection('DEV_versions')
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();

        audit.collections.development.versions = devVersionsSnapshot.docs.map(doc => ({
          id: doc.id,
          content: doc.data().content ? `${doc.data().content.length} chars` : 'null/empty',
          hasContent: !!doc.data().content,
          createdAt: doc.data().createdAt,
          type: doc.data().type
        }));
      } else {
        audit.collections.development.page = { exists: false };
      }
    } catch (error) {
      audit.collections.development.page = { error: error.message };
    }

    // Analysis
    const analysis = {
      issue: 'unknown',
      recommendation: 'unknown'
    };

    if (audit.collections.production.page?.exists && !audit.collections.production.page?.hasContent) {
      if (audit.collections.production.versions.length > 0 && audit.collections.production.versions.some(v => v.hasContent)) {
        analysis.issue = 'production_page_missing_content_but_has_versions';
        analysis.recommendation = 'Run migration: /api/dev/migrate-version-content?production=true&pageId=' + pageId;
      } else if (audit.collections.development.versions.length > 0 && audit.collections.development.versions.some(v => v.hasContent)) {
        analysis.issue = 'production_page_missing_content_versions_in_dev';
        analysis.recommendation = 'Need to migrate versions from DEV_ to production collections first';
      } else {
        analysis.issue = 'no_content_anywhere';
        analysis.recommendation = 'Page appears to have no content in any collection';
      }
    }

    return NextResponse.json({
      success: true,
      audit,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Page version audit error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
