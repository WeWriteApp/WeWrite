/**
 * Related Pages API Endpoint
 * 
 * Finds pages related to a given page based on content similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

// Extract meaningful words from text
function extractMeaningfulWords(text: string): string[] {
  if (!text) return [];
  
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20); // Limit to top 20 words
}

// Calculate similarity score between two sets of words
function calculateSimilarity(words1: string[], words2: string[]): number {
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const pageTitle = searchParams.get('pageTitle') || '';
    const pageContent = searchParams.get('pageContent') || '';
    const linkedPageIds = searchParams.get('linkedPageIds')?.split(',').filter(Boolean) || [];
    const excludeUsername = searchParams.get('excludeUsername');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log(`📄 [RELATED_PAGES_API] Finding related pages for ${pageId}`);
    console.log(`📄 [RELATED_PAGES_API] Title: "${pageTitle}", Content length: ${pageContent.length}`);
    console.log(`📄 [RELATED_PAGES_API] Excluding username: "${excludeUsername || 'none'}"`);

    // Extract meaningful words from title and content
    const titleWords = extractMeaningfulWords(pageTitle);
    const contentWords = extractMeaningfulWords(pageContent.substring(0, 1000)); // First 1000 chars
    const allWords = [...new Set([...titleWords, ...contentWords])];

    if (allWords.length === 0) {
      console.log('📄 [RELATED_PAGES_API] No meaningful words found');
      return NextResponse.json({
        relatedPages: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    console.log(`📄 [RELATED_PAGES_API] Extracted ${allWords.length} meaningful words:`, allWords.slice(0, 10));

    // Get candidate pages (simplified query to avoid index requirements)
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .limit(200) // Limit to avoid timeout
      .get();

    const candidates = [];
    
    for (const doc of pagesSnapshot.docs) {
      const pageData = doc.data();
      
      // Skip the current page, already linked pages, deleted pages, pages without titles, and excluded username's pages
      if (doc.id === pageId ||
          linkedPageIds.includes(doc.id) ||
          !pageData.title ||
          pageData.deleted ||
          (excludeUsername && pageData.username === excludeUsername)) {
        continue;
      }

      // Extract words from candidate page
      const candidateTitleWords = extractMeaningfulWords(pageData.title);
      const candidateContentWords = pageData.content 
        ? extractMeaningfulWords(pageData.content.substring(0, 1000))
        : [];
      const candidateWords = [...new Set([...candidateTitleWords, ...candidateContentWords])];

      // Calculate similarity
      const similarity = calculateSimilarity(allWords, candidateWords);
      
      if (similarity > 0.1) { // Minimum similarity threshold
        candidates.push({
          id: doc.id,
          title: pageData.title,
          username: pageData.username || 'Unknown',
          lastModified: pageData.lastModified,
          isPublic: pageData.isPublic,
          similarity
        });
      }
    }

    // Sort by similarity and take top results
    const relatedPages = candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity, ...page }) => page); // Remove similarity from final result

    console.log(`📄 [RELATED_PAGES_API] Found ${relatedPages.length} related pages (excluding ${excludeUsername ? `pages by ${excludeUsername}` : 'no user filter'})`);

    return NextResponse.json({
      relatedPages,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Related pages API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch related pages',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
