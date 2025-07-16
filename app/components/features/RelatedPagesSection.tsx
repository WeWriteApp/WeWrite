"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";

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
    const scoredCandidates = candidates.map(candidate => {
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
    });

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

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch related pages
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

        // Get related pages based on content similarity
        const related = await getRelatedPagesAsync(page.id, page.title, page.content || '', linkedPageIds, 10);
        console.log('📄 RelatedPagesSection: Related pages found:', related.length, related);
        setRelatedPages(related);
      } catch (error) {
        console.error('Error fetching related pages:', error);
        setRelatedPages([]);
      }
      setLoading(false);
    };

    fetchRelatedPages();
  }, [page?.id, mounted]);

  if (!mounted) {
    return null;
  }

  // Always render the section, even if empty

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Related Pages
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Pages with similar content or topics</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading related pages...</span>
        </div>
      ) : relatedPages.length > 0 ? (
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
                        <div className="text-gray-400">by {relatedPage.username}</div>
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
        <div className="text-sm text-gray-500">
          No related pages found
        </div>
      )}
    </div>
  );
}