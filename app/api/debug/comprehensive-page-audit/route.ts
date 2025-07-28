import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const showSamples = searchParams.get('samples') === 'true';

    console.log('🔍 Starting comprehensive page audit', {
      useProduction,
      limit,
      showSamples
    });

    const admin = initAdmin();
    const db = admin.firestore();
    
    // Use production collections if specified
    const pagesCollection = useProduction ? 'pages' : 'DEV_pages';
    
    console.log(`📊 Auditing collection: ${pagesCollection}`);

    // Get all pages
    const pagesSnapshot = await db
      .collection(pagesCollection)
      .limit(limit)
      .get();

    console.log(`📄 Found ${pagesSnapshot.size} pages to audit`);

    const audit = {
      collection: pagesCollection,
      totalPages: pagesSnapshot.size,
      categories: {
        hasContent: { count: 0, samples: [] as any[] },
        nullContent: { count: 0, samples: [] as any[] },
        emptyContent: { count: 0, samples: [] as any[] },
        undefinedContent: { count: 0, samples: [] as any[] },
        hasVersions: { count: 0, samples: [] as any[] },
        noVersions: { count: 0, samples: [] as any[] },
        needsMigration: { count: 0, samples: [] as any[] }
      },
      statistics: {
        avgContentLength: 0,
        totalContentLength: 0,
        pagesWithContent: 0
      }
    };

    let totalContentLength = 0;
    let pagesWithContent = 0;

    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;
      
      const pageSample = {
        id: pageId,
        title: pageData.title || 'Untitled',
        contentType: typeof pageData.content,
        contentLength: pageData.content ? pageData.content.length : 0,
        hasContent: !!pageData.content,
        createdAt: pageData.createdAt,
        lastModified: pageData.lastModified
      };

      // Check content status
      if (pageData.content === null) {
        audit.categories.nullContent.count++;
        if (showSamples && audit.categories.nullContent.samples.length < 5) {
          audit.categories.nullContent.samples.push(pageSample);
        }
      } else if (pageData.content === undefined) {
        audit.categories.undefinedContent.count++;
        if (showSamples && audit.categories.undefinedContent.samples.length < 5) {
          audit.categories.undefinedContent.samples.push(pageSample);
        }
      } else if (pageData.content === '') {
        audit.categories.emptyContent.count++;
        if (showSamples && audit.categories.emptyContent.samples.length < 5) {
          audit.categories.emptyContent.samples.push(pageSample);
        }
      } else {
        audit.categories.hasContent.count++;
        totalContentLength += pageData.content.length;
        pagesWithContent++;
        if (showSamples && audit.categories.hasContent.samples.length < 5) {
          audit.categories.hasContent.samples.push(pageSample);
        }
      }

      // Check if page has versions (for pages without content)
      if (!pageData.content || pageData.content === null || pageData.content === '') {
        try {
          const versionsSnapshot = await db
            .collection(pagesCollection)
            .doc(pageId)
            .collection('versions')
            .limit(1)
            .get();

          if (!versionsSnapshot.empty) {
            audit.categories.hasVersions.count++;
            audit.categories.needsMigration.count++;
            
            const versionData = versionsSnapshot.docs[0].data();
            const migrationSample = {
              ...pageSample,
              hasVersions: true,
              latestVersionContent: versionData.content ? versionData.content.length : 0,
              versionId: versionsSnapshot.docs[0].id
            };
            
            if (showSamples && audit.categories.needsMigration.samples.length < 10) {
              audit.categories.needsMigration.samples.push(migrationSample);
            }
          } else {
            audit.categories.noVersions.count++;
          }
        } catch (error) {
          console.error(`Error checking versions for page ${pageId}:`, error);
          audit.categories.noVersions.count++;
        }
      }
    }

    // Calculate statistics
    audit.statistics.totalContentLength = totalContentLength;
    audit.statistics.pagesWithContent = pagesWithContent;
    audit.statistics.avgContentLength = pagesWithContent > 0 ? Math.round(totalContentLength / pagesWithContent) : 0;

    const summary = {
      collection: pagesCollection,
      totalPages: audit.totalPages,
      pagesWithContent: audit.categories.hasContent.count,
      pagesNeedingMigration: audit.categories.needsMigration.count,
      contentIssues: {
        null: audit.categories.nullContent.count,
        empty: audit.categories.emptyContent.count,
        undefined: audit.categories.undefinedContent.count
      },
      avgContentLength: audit.statistics.avgContentLength
    };

    console.log('📊 Audit Summary:', summary);

    return NextResponse.json({
      success: true,
      summary,
      audit: showSamples ? audit : { ...audit, categories: Object.fromEntries(
        Object.entries(audit.categories).map(([key, value]) => [key, { count: value.count }])
      )},
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Comprehensive page audit error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
