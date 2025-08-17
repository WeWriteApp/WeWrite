"use client";

import React, { useState, useEffect } from 'react';
import PillLink from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";
import { useAuth } from '../../providers/AuthProvider';

// Import related pages function with working algorithm
const getRelatedPagesAsync = async (pageId: string, pageTitle: string, pageContent: string, linkedPageIds: string[] = [], limit: number = 10) => {
  try {
    const { collection, query, where, getDocs, limit: firestoreLimit } = await import('firebase/firestore');
    const { db } = await import("../../firebase/config");
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // Extract meaningful words from title and content
    const extractMeaningfulWords = (text: string): string[] => {
      if (!text) return [];

      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
      ]);

      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .slice(0, 20); // Limit to top 20 words
    };

    const titleWords = extractMeaningfulWords(pageTitle);
    const contentWords = pageContent ? extractMeaningfulWords(pageContent.substring(0, 1000)) : [];
    const allWords = [...new Set([...titleWords, ...contentWords])];

    if (allWords.length === 0) {
      return [];
    }

    // Query for pages
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('isPublic', '==', true),
      firestoreLimit(200)
    );

    const snapshot = await getDocs(pagesQuery);
    const candidates: any[] = [];

    snapshot.forEach(doc => {
      const pageData = { id: doc.id, ...doc.data() };
      if (pageData.id !== pageId && !linkedPageIds.includes(pageData.id) && !pageData.deleted && pageData.title) {
        candidates.push(pageData);
      }
    });

    // Score candidates based on word overlap
    const scoredCandidates = Array.isArray(candidates) ? candidates.map(candidate => {
      const candidateTitle = candidate.title || '';
      const candidateContent = candidate.content || '';

      const candidateTitleWords = extractMeaningfulWords(candidateTitle);
      const candidateContentWords = extractMeaningfulWords(candidateContent.substring(0, 1000));
      const candidateAllWords = [...new Set([...candidateTitleWords, ...candidateContentWords])];

      // Calculate overlap score
      const titleOverlap = titleWords.filter(word => candidateTitleWords.includes(word)).length;
      const contentOverlap = allWords.filter(word => candidateAllWords.includes(word)).length;

      const score = (titleOverlap * 3) + contentOverlap; // Weight title matches higher

      return {
        ...candidate,
        similarity: Math.min(score / Math.max(allWords.length, 1), 1),
        score
      };
    }) : [];

    return scoredCandidates
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  } catch (error) {
    console.error('Error getting related pages:', error);
    return [];
  }
};

interface RelatedPagesSectionProps {
  page: {
    id: string;
    title: string;
    content?: string;
    username?: string;
    isPublic?: boolean;
  };
  linkedPageIds?: string[];
}

export default function RelatedPagesSection({ page, linkedPageIds = [] }: RelatedPagesSectionProps) {
  const [relatedPages, setRelatedPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch related pages from API
  useEffect(() => {
    if (!page?.id || !mounted) return;

    const fetchRelatedPages = async () => {
      try {
        setLoading(true);
        console.log('📄 RelatedPagesSection: Fetching related pages for:', {
          pageId: page.id,
          pageTitle: page.title,
          hasContent: !!page.content,
          linkedPageIds: linkedPageIds?.length || 0
        });

        // Build API URL with parameters
        const params = new URLSearchParams({
          pageId: page.id,
          pageTitle: page.title || '',
          pageContent: String(page.content || '').substring(0, 2000), // Limit content length for URL
          limit: '10'
        });

        if (linkedPageIds && linkedPageIds.length > 0) {
          params.set('linkedPageIds', linkedPageIds.join(','));
        }

        if (user?.username) {
          params.set('excludeUsername', user.username);
        }

        if (user?.uid) {
          params.set('excludeUserId', user.uid);
        }

        const response = await fetch(`/api/related-pages?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📄 RelatedPagesSection: Related pages found:', data.relatedPages?.length || 0);
        setRelatedPages(data.relatedPages || []);
      } catch (error) {
        console.error('Error fetching related pages:', error);
        setRelatedPages([]);
      }
      setLoading(false);
    };

    fetchRelatedPages();
  }, [page?.id, page?.title, page?.content, linkedPageIds, mounted, user?.username, user?.uid]);

  if (!mounted) {
    return null;
  }

  // Always render the section, even if empty

  return (
    <div>
      <div className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium">
            Related pages by others
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pages with similar content or topics</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading related pages by others...</span>
          </div>
        ) : Array.isArray(relatedPages) && relatedPages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {relatedPages.map((relatedPage, index) => (
              <div key={relatedPage.id} className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PillLink href={`/${relatedPage.id}`}>
                        {relatedPage.title || "Untitled"}
                      </PillLink>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <div className="font-medium">{relatedPage.title || "Untitled"}</div>
                        {relatedPage.username && (
                          <div className="text-muted-foreground">by {relatedPage.username}</div>
                        )}
                        {relatedPage.similarity && (
                          <div className="text-blue-400">
                            {Math.round(relatedPage.similarity * 100)}% similar
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No related pages by others found
          </div>
        )}
      </div>
    </div>
  );
}