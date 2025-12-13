/**
 * Related Pages API v2 - Algolia-Powered
 *
 * Enhanced related pages that uses Algolia search for better text similarity
 * and includes both "related by content" and "more by same author" sections.
 *
 * Query params:
 * - pageId: Current page ID (required)
 * - pageTitle: Page title for similarity search
 * - authorId: Author's user ID for "more by author" results
 * - authorUsername: Author's username for display
 * - excludePageIds: Comma-separated page IDs to exclude (e.g., already linked pages)
 * - limitByOthers: Max results for "by others" (default: 8)
 * - limitByAuthor: Max results for "by author" (default: 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchClient, getAlgoliaIndexName, ALGOLIA_INDICES, type AlgoliaPageRecord } from '../../lib/algolia';

// Extended stop words list for better keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her', 'its', 'our',
  'just', 'like', 'about', 'into', 'over', 'after', 'than', 'then', 'when', 'where', 'which',
  'who', 'what', 'how', 'why', 'from', 'out', 'up', 'down', 'off', 'all', 'any', 'both', 'each',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'very', 'too', 'also', 'back', 'even', 'still', 'way', 'well', 'new', 'now', 'old', 'see',
  'get', 'got', 'make', 'made', 'take', 'took', 'give', 'gave', 'go', 'went', 'come', 'came',
  'say', 'said', 'think', 'thought', 'know', 'knew', 'want', 'wanted', 'use', 'used', 'find',
  'found', 'tell', 'told', 'ask', 'asked', 'work', 'worked', 'seem', 'seemed', 'feel', 'felt',
  'try', 'tried', 'leave', 'left', 'call', 'called', 'need', 'needed', 'keep', 'kept', 'let',
  'begin', 'began', 'seem', 'seemed', 'help', 'helped', 'show', 'showed', 'hear', 'heard',
  'play', 'played', 'run', 'ran', 'move', 'moved', 'live', 'lived', 'believe', 'believed',
  'bring', 'brought', 'happen', 'happened', 'write', 'wrote', 'provide', 'provided', 'sit',
  'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met', 'include', 'included',
  'continue', 'continued', 'set', 'learn', 'learned', 'change', 'changed', 'lead', 'led',
  'understand', 'understood', 'watch', 'watched', 'follow', 'followed', 'stop', 'stopped',
  'create', 'created', 'speak', 'spoke', 'read', 'allow', 'allowed', 'add', 'added', 'spend',
  'spent', 'grow', 'grew', 'open', 'opened', 'walk', 'walked', 'win', 'won', 'offer', 'offered',
  'remember', 'remembered', 'love', 'loved', 'consider', 'considered', 'appear', 'appeared',
  'buy', 'bought', 'wait', 'waited', 'serve', 'served', 'die', 'died', 'send', 'sent', 'expect',
  'expected', 'build', 'built', 'stay', 'stayed', 'fall', 'fell', 'cut', 'reach', 'reached',
  'kill', 'killed', 'remain', 'remained', 'text', 'type', 'children', 'paragraph', 'true', 'false',
  'null', 'undefined', 'object', 'array', 'string', 'number', 'boolean', 'function', 'class'
]);

// Extract key terms from text for better search
function extractSearchTerms(text: string, maxWords: number = 10): string {
  if (!text) return '';

  // Clean up JSON artifacts if content is stringified JSON
  let cleanText = text;
  try {
    // Try to parse as JSON and extract text nodes
    if (text.startsWith('[') || text.startsWith('{')) {
      const parsed = JSON.parse(text);
      cleanText = extractTextFromSlateContent(parsed);
    }
  } catch {
    // Not JSON, use as-is
  }

  return cleanText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, maxWords)
    .join(' ');
}

// Extract plain text from Slate.js JSON content
function extractTextFromSlateContent(content: any): string {
  if (!content) return '';

  // Handle array of nodes (top-level Slate content)
  if (Array.isArray(content)) {
    return content.map(node => extractTextFromSlateContent(node)).join(' ');
  }

  // Handle text leaf nodes
  if (typeof content === 'object') {
    if (content.text) {
      return content.text;
    }
    // Handle element nodes with children
    if (content.children) {
      return extractTextFromSlateContent(content.children);
    }
  }

  if (typeof content === 'string') {
    return content;
  }

  return '';
}

// Extract significant keywords with frequency analysis
function extractKeywords(text: string, maxKeywords: number = 15): string[] {
  if (!text) return [];

  // Clean up JSON artifacts if content is stringified JSON
  let cleanText = text;
  try {
    if (text.startsWith('[') || text.startsWith('{')) {
      const parsed = JSON.parse(text);
      cleanText = extractTextFromSlateContent(parsed);
    }
  } catch {
    // Not JSON, use as-is
  }

  const words = cleanText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOP_WORDS.has(word));

  // Count word frequency
  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  // Sort by frequency and return top keywords
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const pageTitle = searchParams.get('pageTitle') || '';
    const pageContent = searchParams.get('pageContent') || '';
    const authorId = searchParams.get('authorId');
    const authorUsername = searchParams.get('authorUsername');
    const excludePageIds = searchParams.get('excludePageIds')?.split(',').filter(Boolean) || [];
    const limitByOthers = parseInt(searchParams.get('limitByOthers') || '8');
    const limitByAuthor = parseInt(searchParams.get('limitByAuthor') || '5');

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        relatedByOthers: [],
        relatedByAuthor: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    console.log(`🔍 [RELATED_V2] Finding related pages for ${pageId}`);
    console.log(`🔍 [RELATED_V2] Title: "${pageTitle}", Author: ${authorUsername || authorId || 'unknown'}`);
    console.log(`🔍 [RELATED_V2] Content length: ${pageContent?.length || 0} chars`);

    // Build exclusion list
    const excludeIds = new Set([pageId, ...excludePageIds]);

    // Extract search terms from title (prioritized) and content keywords (frequency-based)
    const titleTerms = extractSearchTerms(pageTitle, 8);
    const contentKeywords = extractKeywords(pageContent, 12);

    console.log(`🔍 [RELATED_V2] Title terms: "${titleTerms}"`);
    console.log(`🔍 [RELATED_V2] Content keywords: [${contentKeywords.join(', ')}]`);

    // Build a more effective search query:
    // - Title terms appear twice (higher weight)
    // - Content keywords from frequency analysis
    // - Join keywords for phrase-like matching
    const searchQuery = [
      titleTerms,
      titleTerms, // Repeat for higher weight
      contentKeywords.join(' ')
    ].filter(Boolean).join(' ').trim();

    const client = getSearchClient();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

    // Parallel requests for both categories
    const [byOthersResponse, byAuthorResponse] = await Promise.all([
      // Search for related pages by OTHER authors
      searchQuery ? client.searchSingleIndex<AlgoliaPageRecord>({
        indexName,
        searchParams: {
          query: searchQuery,
          hitsPerPage: limitByOthers + excludeIds.size + 5, // Extra to account for filtering
          filters: authorId
            ? `isPublic:true AND NOT authorId:${authorId}`
            : 'isPublic:true',
          attributesToRetrieve: [
            'objectID',
            'title',
            'authorId',
            'authorUsername',
            'isPublic',
            'lastModified'
          ],
        },
      }) : Promise.resolve({ hits: [] }),

      // Get more pages by the SAME author
      authorId ? client.searchSingleIndex<AlgoliaPageRecord>({
        indexName,
        searchParams: {
          query: '', // Empty query to get all
          hitsPerPage: limitByAuthor + excludeIds.size + 2,
          filters: `isPublic:true AND authorId:${authorId}`,
          attributesToRetrieve: [
            'objectID',
            'title',
            'authorId',
            'authorUsername',
            'isPublic',
            'lastModified'
          ],
        },
      }) : Promise.resolve({ hits: [] }),
    ]);

    // Filter out excluded pages and format results
    const relatedByOthers = byOthersResponse.hits
      .filter((hit: AlgoliaPageRecord) => !excludeIds.has(hit.objectID))
      .slice(0, limitByOthers)
      .map((hit: AlgoliaPageRecord) => ({
        id: hit.objectID,
        title: hit.title,
        username: hit.authorUsername || 'Unknown',
        authorId: hit.authorId,
        lastModified: hit.lastModified,
        isPublic: hit.isPublic,
      }));

    const relatedByAuthor = byAuthorResponse.hits
      .filter((hit: AlgoliaPageRecord) => !excludeIds.has(hit.objectID))
      .slice(0, limitByAuthor)
      .map((hit: AlgoliaPageRecord) => ({
        id: hit.objectID,
        title: hit.title,
        username: hit.authorUsername || authorUsername || 'Unknown',
        authorId: hit.authorId,
        lastModified: hit.lastModified,
        isPublic: hit.isPublic,
      }));

    const responseTime = Date.now() - startTime;
    console.log(`🔍 [RELATED_V2] Found ${relatedByOthers.length} by others, ${relatedByAuthor.length} by author in ${responseTime}ms`);

    return NextResponse.json({
      relatedByOthers,
      relatedByAuthor,
      authorUsername: authorUsername || null,
      searchQuery: searchQuery || null,
      responseTime,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Related pages v2 API error:', error);

    return NextResponse.json({
      error: 'Failed to fetch related pages',
      relatedByOthers: [],
      relatedByAuthor: [],
      details: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 200 }); // Return 200 to prevent console errors
  }
}
