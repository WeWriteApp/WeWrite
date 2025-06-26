"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { isExactDateFormat as isDailyNoteFormat } from "../../utils/dailyNoteNavigation";

// Import the database functions
const findBacklinksAsync = async (pageId, limit) => {
  const { findBacklinks } = await import('../../firebase/database');
  return findBacklinks(pageId, limit);
};

const getNavigationBacklinksAsync = async (pageId) => {
  const { getNavigationBacklinks } = await import('../../utils/navigationTracking');
  return getNavigationBacklinks(pageId);
};

/**
 * CombinedLinksSection Component
 *
 * Renders "What Links Here" and "Related Pages" as one seamless text block
 * that flows naturally like a paragraph below the main content.
 */
export default function CombinedLinksSection({ page, linkedPageIds = [] }) {
  const [backlinks, setBacklinks] = useState([]);
  const [relatedPages, setRelatedPages] = useState([]);
  const [backlinksLoading, setBacklinksLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [backlinksExpanded, setBacklinksExpanded] = useState(false);
  const [relatedExpanded, setRelatedExpanded] = useState(false);
  const [backlinksTyping, setBacklinksTyping] = useState(false);
  const [relatedTyping, setRelatedTyping] = useState(false);
  const { formatDateString } = useDateFormat();

  // Typing animation effect for backlinks description
  const backlinksDescription = "Pages that contain links to this page. Pages already linked in the content appear with reduced opacity.";
  const [backlinksDisplayText, setBacklinksDisplayText] = useState("");

  // Typing animation effect for related pages description
  const relatedDescription = "Enhanced algorithm that finds pages with similar content using sophisticated word matching. Analyzes both titles and content, supports partial word matching, and uses advanced relevance scoring similar to the main search functionality. Title matches are prioritized over content matches.";
  const [relatedDisplayText, setRelatedDisplayText] = useState("");

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Typing animation for backlinks description
  useEffect(() => {
    let typingInterval;

    if (backlinksExpanded && !backlinksTyping) {
      // Expanding - type forward word by word
      setBacklinksTyping(true);
      setBacklinksDisplayText("");

      const words = backlinksDescription.split(' ');
      let currentWordIndex = 0;

      typingInterval = setInterval(() => {
        if (currentWordIndex < words.length) {
          const displayText = words.slice(0, currentWordIndex + 1).join(' ');
          setBacklinksDisplayText(displayText);
          currentWordIndex++;
        } else {
          // Ensure we show the complete text
          setBacklinksDisplayText(backlinksDescription);
          clearInterval(typingInterval);
          setBacklinksTyping(false);
        }
      }, 10); // Increased to 10ms per word for better visibility
    } else if (!backlinksExpanded && backlinksDisplayText.length > 0 && !backlinksTyping) {
      // Collapsing - type backward word by word
      setBacklinksTyping(true);

      const words = backlinksDisplayText.split(' ');
      let currentWordIndex = words.length - 1;

      typingInterval = setInterval(() => {
        if (currentWordIndex >= 0) {
          const displayText = words.slice(0, currentWordIndex + 1).join(' ');
          setBacklinksDisplayText(displayText);
          currentWordIndex--;
        } else {
          clearInterval(typingInterval);
          setBacklinksDisplayText("");
          setBacklinksTyping(false);
        }
      }, 10); // 10ms per word
    }

    return () => {
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    };
  }, [backlinksExpanded, backlinksDescription]);

  // Typing animation for related pages description
  useEffect(() => {
    let typingInterval;

    if (relatedExpanded && !relatedTyping) {
      // Expanding - type forward word by word
      setRelatedTyping(true);
      setRelatedDisplayText("");

      const words = relatedDescription.split(' ');
      let currentWordIndex = 0;

      typingInterval = setInterval(() => {
        if (currentWordIndex < words.length) {
          const displayText = words.slice(0, currentWordIndex + 1).join(' ');
          setRelatedDisplayText(displayText);
          currentWordIndex++;
        } else {
          // Ensure we show the complete text
          setRelatedDisplayText(relatedDescription);
          clearInterval(typingInterval);
          setRelatedTyping(false);
        }
      }, 10); // Increased to 10ms per word for better visibility
    } else if (!relatedExpanded && relatedDisplayText.length > 0 && !relatedTyping) {
      // Collapsing - type backward word by word
      setRelatedTyping(true);

      const words = relatedDisplayText.split(' ');
      let currentWordIndex = words.length - 1;

      typingInterval = setInterval(() => {
        if (currentWordIndex >= 0) {
          const displayText = words.slice(0, currentWordIndex + 1).join(' ');
          setRelatedDisplayText(displayText);
          currentWordIndex--;
        } else {
          clearInterval(typingInterval);
          setRelatedDisplayText("");
          setRelatedTyping(false);
        }
      }, 10); // 10ms per word
    }

    return () => {
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    };
  }, [relatedExpanded, relatedDescription]);

  // Fetch backlinks
  useEffect(() => {
    if (!page?.id || !mounted) return;

    const fetchBacklinks = async () => {
      try {
        const contentBacklinks = await findBacklinksAsync(page.id, 40);
        const navigationBacklinkIds = await getNavigationBacklinksAsync(page.id);

        // Get navigation backlinks data
        const navigationBacklinks = [];
        if (navigationBacklinkIds && navigationBacklinkIds.length > 0) {
          try {
            const { getBatchPages } = await import('../../utils/requestCache');
            const navPagesData = await getBatchPages(navigationBacklinkIds);

            // Convert the object result to array format
            const navPages = Object.entries(navPagesData).map(([id, pageData]) => ({
              id,
              ...pageData
            }));

            navigationBacklinks.push(...navPages.filter(p => p && p.id !== page.id));
          } catch (error) {
            console.error('Error fetching navigation backlinks:', error);
          }
        }

        // Combine and deduplicate
        const allBacklinks = [...contentBacklinks];
        navigationBacklinks.forEach(navPage => {
          if (!allBacklinks.find(existing => existing.id === navPage.id)) {
            allBacklinks.push(navPage);
          }
        });

        // Mark already linked pages
        const processedBacklinks = allBacklinks.map(backlink => ({
          ...backlink,
          isAlreadyLinked: linkedPageIds && linkedPageIds.includes(backlink.id)
        }));

        // Sort and limit
        const limitedBacklinks = processedBacklinks
          .sort((a, b) => a.isAlreadyLinked ? 1 : -1)
          .slice(0, 20);

        setBacklinks(limitedBacklinks);
      } catch (error) {
        console.error('Error fetching backlinks:', error);
        setBacklinks([]);
      }
      setBacklinksLoading(false);
    };

    fetchBacklinks();
  }, [page?.id, linkedPageIds, mounted]);

  // Fetch related pages
  useEffect(() => {
    if (!page?.id || !mounted) return;

    const fetchRelatedPages = async () => {
      try {
        // Import the related pages logic
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const { db } = await import("../../firebase/config");

        // Get public pages for analysis
        const pagesQuery = query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          limit(500)
        );

        const snapshot = await getDocs(pagesQuery);
        const candidates = [];

        snapshot.forEach(doc => {
          const pageData = { id: doc.id, ...doc.data() };
          if (pageData.id !== page.id && !linkedPageIds?.includes(pageData.id)) {
            candidates.push(pageData);
          }
        });

        // Simple scoring based on title similarity
        const currentTitle = page.title?.toLowerCase() || '';
        const currentWords = currentTitle.split(/\s+/).filter(word => word.length > 2);

        const scoredCandidates = candidates.map(candidate => {
          const candidateTitle = candidate.title?.toLowerCase() || '';
          const candidateWords = candidateTitle.split(/\s+/).filter(word => word.length > 2);

          let score = 0;
          currentWords.forEach(word => {
            if (candidateWords.some(cWord => cWord.includes(word) || word.includes(cWord))) {
              score += 1;
            }
          });

          return { ...candidate, score };
        });

        const sortedCandidates = scoredCandidates
          .filter(candidate => candidate.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(candidate => ({
            ...candidate,
            isAlreadyLinked: linkedPageIds && linkedPageIds.includes(candidate.id)
          }));

        setRelatedPages(sortedCandidates);
      } catch (error) {
        console.error('Error fetching related pages:', error);
        setRelatedPages([]);
      }
      setRelatedLoading(false);
    };

    fetchRelatedPages();
  }, [page?.id, linkedPageIds, mounted]);

  const isLoading = backlinksLoading || relatedLoading;

  return (
    <div className="mt-8 pt-6 w-full max-w-none box-border overflow-hidden">
      {/* Backlinks section - separate row */}
      <div className="text-base font-normal" style={{lineHeight: '2rem'}}>
        <span className="inline">Backlinks</span>
        <HelpCircle
          className={`h-4 w-4 cursor-pointer transition-all duration-200 inline ml-1 mr-1 ${
            backlinksExpanded
              ? 'text-foreground opacity-100'
              : 'text-muted-foreground opacity-50 hover:opacity-75'
          }`}
          style={{verticalAlign: 'middle'}}
          onClick={() => setBacklinksExpanded(!backlinksExpanded)}
        />

        {/* Expandable description for What Links Here - show during typing animation */}
        {(backlinksExpanded || backlinksTyping) && (
          <span className="text-base text-muted-foreground/70 inline mr-1" style={{verticalAlign: 'middle'}}>
            {backlinksDisplayText}
          </span>
        )}

        {backlinksLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin inline mr-1" style={{verticalAlign: 'middle'}} />
        ) : backlinks.length > 0 ? (
          <span className="inline">
            {backlinks.map((page, index) => (
              <span key={page.id} className="inline mr-1" style={{verticalAlign: 'middle'}}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={page.isAlreadyLinked ? "opacity-60" : ""}>
                        <PillLink
                          href={`/${page.id}`}
                          className="max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[300px] truncate"
                          style={{verticalAlign: 'middle'}}
                        >
                          {page.title && isExactDateFormat(page.title)
                            ? formatDateString(page.title)
                            : (page.title || "Untitled")}
                        </PillLink>
                      </span>
                    </TooltipTrigger>
                    {page.isAlreadyLinked && (
                      <TooltipContent side="top" className="max-w-[200px]">
                        Already linked in page content
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </span>
            ))}
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 text-sm rounded-full border border-border text-muted-foreground bg-muted/20 mr-1" style={{verticalAlign: 'middle'}}>
            No pages link here
          </span>
        )}
      </div>

      {/* Related Pages section - separate row, closely butted up */}
      <div className="text-base font-normal" style={{lineHeight: '2rem'}}>
        <span className="inline">Related Pages</span>
        <HelpCircle
          className={`h-4 w-4 cursor-pointer transition-all duration-200 inline ml-1 mr-1 ${
            relatedExpanded
              ? 'text-foreground opacity-100'
              : 'text-muted-foreground opacity-50 hover:opacity-75'
          }`}
          style={{verticalAlign: 'middle'}}
          onClick={() => setRelatedExpanded(!relatedExpanded)}
        />

        {/* Expandable description for Related Pages - show during typing animation */}
        {(relatedExpanded || relatedTyping) && (
          <span className="text-base text-muted-foreground/70 inline mr-1" style={{verticalAlign: 'middle'}}>
            {relatedDisplayText}
          </span>
        )}

        {relatedLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin inline mr-1" style={{verticalAlign: 'middle'}} />
        ) : relatedPages.length > 0 ? (
          <span className="inline">
            {relatedPages.map((page, index) => (
              <span key={page.id} className="inline mr-1" style={{verticalAlign: 'middle'}}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={page.isAlreadyLinked ? "opacity-60" : ""}>
                        <PillLink
                          href={`/${page.id}`}
                          className="max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[300px] truncate"
                          style={{verticalAlign: 'middle'}}
                        >
                          {page.title && isDailyNoteFormat(page.title)
                            ? formatDateString(page.title)
                            : (page.title || "Untitled")}
                        </PillLink>
                      </span>
                    </TooltipTrigger>
                    {page.isAlreadyLinked && (
                      <TooltipContent side="top" className="max-w-[200px]">
                        Already linked in page content
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </span>
            ))}
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 text-sm rounded-full border border-border text-muted-foreground bg-muted/20 mr-1" style={{verticalAlign: 'middle'}}>
            No pages link here
          </span>
        )}
      </div>
    </div>
  );
}
