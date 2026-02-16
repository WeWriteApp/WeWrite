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
  matchType: 'exact' | 'exact-alt';
}

interface PageWithTitles {
  id: string;
  title: string;
  alternativeTitles: string[];
  username: string;
  userId: string;
  lastModified: string;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find all exact matches of a title in the text (case-insensitive, word boundary)
 * Returns array of { startIndex, endIndex } for each match
 */
function findExactMatches(text: string, title: string): { startIndex: number; endIndex: number }[] {
  if (!title || title.length < 2) return [];

  const matches: { startIndex: number; endIndex: number }[] = [];
  const escapedTitle = escapeRegex(title);

  // Use word boundary matching to ensure we match complete words/phrases
  // \b doesn't work well with special chars, so we use a lookahead/lookbehind approach
  const regex = new RegExp(`(?<![\\w])${escapedTitle}(?![\\w])`, 'gi');

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return matches;
}

/**
 * Look up username from userId
 */
async function getUsernameFromUserId(db: FirebaseFirestore.Firestore, userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    const usersCollectionName = getCollectionName('users');
    const userDoc = await db.collection(usersCollectionName).doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.username || null;
    }
  } catch (error) {
    console.error(`🔴 LINK_SUGGESTIONS: Error looking up username for ${userId}:`, error);
  }
  return null;
}

/**
 * Fetch all pages with their titles and alternative titles
 */
async function fetchAllPagesWithTitles(
  excludePageId?: string
): Promise<PageWithTitles[]> {
  try {
    const db = getFirebaseAdmin().firestore();
    const pagesCollectionName = getCollectionName('pages');


    const pagesQuery = await db.collection(pagesCollectionName)
      .where('deleted', '!=', true)
      .get();


    const pages: PageWithTitles[] = [];

    for (const doc of pagesQuery.docs) {
      const data = doc.data();

      // Skip deleted pages and the current page being edited
      if (data.deleted === true) continue;
      if (excludePageId && doc.id === excludePageId) continue;

      // Skip pages without titles
      if (!data.title || data.title.trim().length < 2) continue;

      // Get username
      let username = data.username;
      const looksLikeUserId = username && username.length > 15 && /^[a-zA-Z0-9]+$/.test(username);
      if ((!username || looksLikeUserId) && data.userId) {
        const realUsername = await getUsernameFromUserId(db, data.userId);
        if (realUsername) {
          username = realUsername;
        }
      }

      pages.push({
        id: doc.id,
        title: data.title,
        alternativeTitles: data.alternativeTitles || [],
        username: username || '',
        userId: data.userId || '',
        lastModified: data.lastModified?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    }

    return pages;
  } catch (error) {
    console.error('🔴 LINK_SUGGESTIONS: Error fetching pages:', error);
    return [];
  }
}

/**
 * Find exact matches of page titles/alt-titles in the given text
 * Returns suggestions sorted by confidence (exact title matches first, then alt-title matches)
 */
function findTitleMatchesInText(
  text: string,
  pages: PageWithTitles[]
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const textLower = text.toLowerCase();

  for (const page of pages) {
    // Check main title first (highest priority)
    const titleMatches = findExactMatches(text, page.title);
    for (const match of titleMatches) {
      suggestions.push({
        id: page.id,
        title: page.title,
        username: page.username,
        userId: page.userId,
        lastModified: page.lastModified,
        matchedText: text.substring(match.startIndex, match.endIndex),
        confidence: 1.0, // Exact title match = highest confidence
        startIndex: match.startIndex,
        endIndex: match.endIndex,
        matchType: 'exact'
      });
    }

    // Check alternative titles (slightly lower priority)
    for (const altTitle of page.alternativeTitles) {
      if (!altTitle || altTitle.trim().length < 2) continue;

      const altMatches = findExactMatches(text, altTitle);
      for (const match of altMatches) {
        suggestions.push({
          id: page.id,
          title: page.title, // Show the main title, not the alt
          username: page.username,
          userId: page.userId,
          lastModified: page.lastModified,
          matchedText: text.substring(match.startIndex, match.endIndex),
          confidence: 0.95, // Alt-title match = slightly lower confidence
          startIndex: match.startIndex,
          endIndex: match.endIndex,
          matchType: 'exact-alt'
        });
      }
    }
  }

  // Sort by confidence (exact > alt) and then by match length (longer matches first)
  suggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  // Deduplicate by page ID (keep the best match for each page)
  const seenPageIds = new Set<string>();
  const uniqueSuggestions: LinkSuggestion[] = [];

  for (const suggestion of suggestions) {
    if (!seenPageIds.has(suggestion.id)) {
      seenPageIds.add(suggestion.id);
      uniqueSuggestions.push(suggestion);
    }
  }

  return uniqueSuggestions.slice(0, 10);
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

    // Skip very short text
    if (text.trim().length < 3) {
      return NextResponse.json({
        success: true,
        suggestions: []
      });
    }


    // Fetch all pages with their titles and alternative titles
    const pages = await fetchAllPagesWithTitles(excludePageId);


    // Find exact title/alt-title matches in the text
    const suggestions = findTitleMatchesInText(text, pages);


    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 5) // Limit to top 5 suggestions
    });
  } catch (error) {
    console.error('🔴 LINK_SUGGESTIONS_API: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
