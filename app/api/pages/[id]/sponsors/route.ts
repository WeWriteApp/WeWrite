import { NextRequest, NextResponse } from 'next/server';
import { getPagePledgeStats } from '../../../../services/pledgeStatsService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 [SPONSORS API] Fetching sponsor count for page: ${pageId}`);

    // Get pledge statistics for the page
    const pledgeStats = await getPagePledgeStats(pageId);

    console.log(`✅ [SPONSORS API] Found ${pledgeStats.sponsorCount} sponsors for page ${pageId}`);

    return NextResponse.json({
      success: true,
      pageId,
      sponsorCount: pledgeStats.sponsorCount,
      totalPledgedTokens: pledgeStats.totalPledgedTokens,
      uniqueSponsors: pledgeStats.uniqueSponsors
    });

  } catch (error) {
    console.error(`❌ [SPONSORS API] Error fetching sponsors for page:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sponsor data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
