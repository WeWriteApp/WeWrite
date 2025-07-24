import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

interface LinkSuggestion {
  id: string;
  title: string;
  username: string;
  userId: string;
  lastModified: string;
  matchedText: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  matchType: 'exact' | 'partial' | 'content';
}

/**
 * Extract meaningful words from text (remove common words)
 */
function extractMeaningfulWords(text: string): string[] {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us', 'them'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word));
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(phrase: string, title: string, content: string): number {
  const phraseLower = phrase.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact title match (case insensitive)
  if (titleLower === phraseLower) return 1.0;

  // Title contains phrase (but not phrase contains title to avoid "one" matching "Another One")
  if (titleLower.includes(phraseLower)) return 0.8;

  // Word overlap for more complex matching
  const phraseWords = extractMeaningfulWords(phrase);
  const titleWords = extractMeaningfulWords(title);

  if (phraseWords.length === 0 || titleWords.length === 0) return 0.1;

  const overlap = phraseWords.filter(word => titleWords.includes(word)).length;
  const overlapRatio = overlap / Math.max(phraseWords.length, titleWords.length);

  return Math.max(0.3, overlapRatio * 0.6);
}

/**
 * Search for pages that match a specific phrase
 */
async function searchPagesForPhrase(
  phrase: string,
  currentUserId?: string,
  excludePageId?: string
): Promise<Omit<LinkSuggestion, 'matchedText' | 'startIndex' | 'endIndex'>[]> {
  try {
    const db = getFirebaseAdmin().firestore();
    const pagesCollectionName = getCollectionName('pages');
    
    console.log(`🔗 LINK_SUGGESTIONS: Searching for phrase "${phrase}" in pages collection: ${pagesCollectionName} (FIXED VERSION)`);

    // Search for pages where title contains the phrase (case-insensitive)
    // Note: We need to search ALL pages since Firestore doesn't support case-insensitive queries
    const titleQuery = await db.collection(pagesCollectionName)
      .where('deleted', '!=', true)
      .get();

    console.log(`🔗 LINK_SUGGESTIONS: Query returned ${titleQuery.docs.length} total documents`);

    const pages: any[] = [];
    const phraseLower = phrase.toLowerCase();

    // Debug: Log first few titles to see what we're getting
    const sampleTitles = titleQuery.docs.slice(0, 10).map(doc => doc.data().title).filter(Boolean);
    console.log(`🔗 LINK_SUGGESTIONS: Sample titles from query: ${JSON.stringify(sampleTitles)}`);

    titleQuery.docs.forEach(doc => {
      const data = doc.data();
      const title = data.title?.toLowerCase() || '';

      // Skip deleted pages
      if (data.deleted === true) return;

      // Check for exact match first (highest priority) - case insensitive
      const isExactMatch = title === phraseLower;

      // Only include exact matches or title contains phrase (not phrase contains title)
      // This prevents "one" from matching "Another One"
      const titleContainsPhrase = title.includes(phraseLower);

      if (isExactMatch || titleContainsPhrase) {
        console.log(`🔗 LINK_SUGGESTIONS: Found match for "${phrase}": "${data.title}" (exact: ${isExactMatch}, titleContains: ${titleContainsPhrase})`);

        pages.push({
          id: doc.id,
          title: data.title,
          username: data.username || 'Unknown',
          userId: data.userId || '',
          lastModified: data.lastModified?.toDate?.()?.toISOString() || new Date().toISOString(),
          isPublic: data.isPublic !== false,
          content: data.content || ''
        });
      }
    });
    
    console.log(`🔗 LINK_SUGGESTIONS: Found ${pages.length} potential matches for phrase "${phrase}"`);
    
    return pages
      .filter((page: any) => {
        // Exclude current page
        if (excludePageId && page.id === excludePageId) return false;
        
        // Include all pages (both own and others')
        return true;
      })
      .map((page: any) => {
        const phraseWords = extractMeaningfulWords(phrase);
        const titleWords = extractMeaningfulWords(page.title);
        
        // Calculate match type and confidence
        let matchType: LinkSuggestion['matchType'] = 'content';
        let confidence = 0.3;
        
        // Exact title match (case insensitive)
        if (page.title.toLowerCase() === phrase.toLowerCase()) {
          matchType = 'exact';
          confidence = 1.0;
        }
        // Partial title match (only when title contains phrase, not when phrase contains title)
        else if (page.title.toLowerCase().includes(phrase.toLowerCase())) {
          matchType = 'partial';
          confidence = calculateConfidence(phrase, page.title, page.content || '');
        }
        
        return {
          id: page.id,
          title: page.title,
          username: page.username,
          userId: page.userId,
          lastModified: page.lastModified,
          confidence,
          matchType
        };
      })
      .filter(suggestion => suggestion.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
      
  } catch (error) {
    console.error(`🔴 LINK_SUGGESTIONS: Error searching for phrase: ${phrase}`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text');
    const userId = searchParams.get('userId');
    const excludePageId = searchParams.get('excludePageId') || undefined;

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'Text parameter is required'
      }, { status: 400 });
    }

    console.log('🔗 LINK_SUGGESTIONS_API: Analyzing text for link opportunities:', {
      textLength: text.length,
      userId,
      excludePageId: excludePageId || 'none'
    });

    // Extract meaningful phrases from the text
    const words = extractMeaningfulWords(text);
    const phrases = [
      ...words, // Individual words
      ...words.slice(0, -1).map((word, i) => `${word} ${words[i + 1]}`) // Word pairs
    ].filter(phrase => phrase.length >= 3);

    console.log('🔗 LINK_SUGGESTIONS_API: Found linkable phrases:', phrases);

    // Search for each phrase
    const allSuggestions: any[] = [];
    for (const phrase of phrases.slice(0, 5)) { // Limit to first 5 phrases
      const suggestions = await searchPagesForPhrase(phrase, userId, excludePageId);
      
      // Add phrase context to suggestions
      suggestions.forEach(suggestion => {
        allSuggestions.push({
          ...suggestion,
          matchedText: phrase,
          startIndex: text.toLowerCase().indexOf(phrase.toLowerCase()),
          endIndex: text.toLowerCase().indexOf(phrase.toLowerCase()) + phrase.length
        });
      });
    }

    // Deduplicate and sort by confidence
    const uniqueSuggestions = allSuggestions
      .filter((suggestion, index, array) => 
        array.findIndex(s => s.id === suggestion.id) === index
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    console.log('🔗 LINK_SUGGESTIONS_API: Found suggestions:', {
      totalSuggestions: uniqueSuggestions.length,
      topSuggestions: uniqueSuggestions.slice(0, 3).map(s => ({ title: s.title, confidence: s.confidence }))
    });

    return NextResponse.json({
      success: true,
      suggestions: uniqueSuggestions
    });
  } catch (error) {
    console.error('🔴 LINK_SUGGESTIONS_API: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
