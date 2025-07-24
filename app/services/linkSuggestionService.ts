/**
 * Link Suggestion Service (Client-Side Only)
 *
 * This service only handles API calls to the server-side link suggestion endpoint.
 * All actual analysis is done server-side to avoid importing Firebase Admin on the client.
 */

export interface LinkSuggestion {
  id: string;
  title: string;
  username: string;
  userId: string;
  lastModified: string;
  isPublic: boolean;
  matchType: 'exact' | 'partial' | 'content' | 'keyword';
  matchedText: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface LinkSuggestionResult {
  suggestions: LinkSuggestion[];
  totalMatches: number;
}

/**
 * Find pages that match the given text content (Client-side API call only)
 */
export async function findLinkSuggestions(
  textContent: string,
  currentUserId?: string,
  excludePageId?: string
): Promise<LinkSuggestionResult> {
  try {
    if (!textContent || textContent.trim().length < 3) {
      return { suggestions: [], totalMatches: 0 };
    }

    console.warn('🔗 LINK_SUGGESTIONS: CLIENT-SIDE findLinkSuggestions called!', {
      textLength: textContent.length,
      currentUserId: currentUserId || 'anonymous',
      excludePageId: excludePageId || 'none',
      text: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '')
    });

    // Call the API endpoint instead of doing client-side search
    const params = new URLSearchParams({
      text: textContent,
      ...(currentUserId && { userId: currentUserId }),
      ...(excludePageId && { excludePageId })
    });

    console.warn('🔗 LINK_SUGGESTIONS: Calling API endpoint with params:', params.toString());

    const response = await fetch(`/api/link-suggestions?${params}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }

    console.warn('🔗 LINK_SUGGESTIONS: API response received:', {
      totalSuggestions: data.suggestions?.length || 0,
      topSuggestions: data.suggestions?.slice(0, 3).map((s: any) => ({
        title: s.title,
        matchedText: s.matchedText,
        confidence: s.confidence
      })) || []
    });

    return {
      suggestions: data.suggestions || [],
      totalMatches: data.suggestions?.length || 0
    };

  } catch (error) {
    console.error('🔴 LINK_SUGGESTIONS: Error finding suggestions:', error);
    return { suggestions: [], totalMatches: 0 };
  }
}



/**
 * Debounced version of findLinkSuggestions for real-time analysis
 */
export const debouncedFindLinkSuggestions = (() => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (
    textContent: string,
    currentUserId?: string,
    excludePageId?: string,
    delay: number = 1000
  ): Promise<LinkSuggestionResult> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(async () => {
        const result = await findLinkSuggestions(textContent, currentUserId, excludePageId);
        resolve(result);
      }, delay);
    });
  };
})();
