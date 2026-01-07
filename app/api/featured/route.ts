/**
 * Featured Content API
 *
 * Returns high-quality, high-engagement content for the featured page.
 * Combines multiple signals: views, pledges/sponsors, and incoming links.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

export const maxDuration = 30;

interface FeaturedPage {
  id: string;
  title: string;
  username: string;
  userId: string;
  lastModified: string;
  viewCount: number;
  sponsorCount: number;
  backlinkCount: number;
  excerpt: string;
  score: number;
}

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const category = searchParams.get('category'); // 'most-viewed', 'most-supported', 'most-linked'

    // Get pages sorted by different metrics
    const pagesRef = db.collection(getCollectionName('pages'));

    let query = pagesRef
      .where('isPublic', '==', true)
      .orderBy('viewCount', 'desc')
      .limit(100); // Get more to compute scores

    const snapshot = await query.get();

    const pages: FeaturedPage[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.deleted) continue;

      // Extract excerpt from content
      let excerpt = '';
      if (data.content && Array.isArray(data.content)) {
        const firstParagraph = data.content.find((node: any) =>
          node.children?.[0]?.text
        );
        excerpt = firstParagraph?.children?.[0]?.text?.slice(0, 150) || '';
      }

      // Calculate engagement score
      const viewScore = Math.log10((data.viewCount || 0) + 1) * 10;
      const sponsorScore = (data.sponsorCount || 0) * 20;
      const backlinkScore = (data.backlinkCount || 0) * 15;

      // Recency bonus (pages modified in last 30 days get a boost)
      let recencyBonus = 0;
      if (data.lastModified) {
        const lastMod = data.lastModified.toDate?.() || new Date(data.lastModified);
        const daysSinceModified = (Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 30) {
          recencyBonus = (30 - daysSinceModified) / 3; // Up to 10 bonus points
        }
      }

      const totalScore = viewScore + sponsorScore + backlinkScore + recencyBonus;

      pages.push({
        id: doc.id,
        title: data.title || 'Untitled',
        username: data.username || 'Unknown',
        userId: data.userId,
        lastModified: data.lastModified?.toDate?.()?.toISOString() ||
                     data.lastModified || new Date().toISOString(),
        viewCount: data.viewCount || 0,
        sponsorCount: data.sponsorCount || 0,
        backlinkCount: data.backlinkCount || 0,
        excerpt,
        score: totalScore
      });
    }

    // Sort by score and filter by category if specified
    let sortedPages = pages.sort((a, b) => b.score - a.score);

    if (category === 'most-viewed') {
      sortedPages = pages.sort((a, b) => b.viewCount - a.viewCount);
    } else if (category === 'most-supported') {
      sortedPages = pages.sort((a, b) => b.sponsorCount - a.sponsorCount);
    } else if (category === 'most-linked') {
      sortedPages = pages.sort((a, b) => b.backlinkCount - a.backlinkCount);
    }

    return NextResponse.json({
      success: true,
      pages: sortedPages.slice(0, limit),
      totalCount: sortedPages.length
    });

  } catch (error) {
    console.error('Featured API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch featured content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
