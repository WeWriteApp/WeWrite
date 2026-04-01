import React, { useState, useEffect } from 'react';
import { createReplyContent } from '../utils/replyUtils';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

interface UseNewPageSetupOptions {
  pageId: string;
  user: any;
  searchParams: any;
  setPage: (fn: any) => void;
  setTitle: (title: string) => void;
  setEditorState: (state: any) => void;
  setCustomDate: (date: string | null) => void;
  setLocation: (loc: any) => void;
  setIsLoading: (loading: boolean) => void;
  isNewPageRef: React.MutableRefObject<boolean>;
}

/**
 * Manages new page mode: derives isNewPageMode from searchParams (stable after mount),
 * handles scroll-to-top, parses URL params, and sets up initial page state.
 */
export function useNewPageSetup({
  pageId,
  user,
  searchParams,
  setPage,
  setTitle,
  setEditorState,
  setCustomDate,
  setLocation,
  setIsLoading,
  isNewPageRef,
}: UseNewPageSetupOptions) {
  // Derive isNewPageMode from searchParams - stable after mount via useState initializer
  // This prevents sensitivity to Next.js router updates after URL changes
  const [isNewPageMode] = useState(() => {
    return searchParams?.get('new') === 'true' || searchParams?.get('draft') === 'true';
  });

  const [newPageCreated, setNewPageCreated] = useState(false);
  const [isClosingNewPage, setIsClosingNewPage] = useState(false);
  // Track if we've scrolled to top - prevents rendering full page at wrong scroll position
  const [isScrollReady, setIsScrollReady] = useState(!isNewPageMode);

  // For new page mode, scroll to top and mark ready before rendering content
  React.useLayoutEffect(() => {
    if (isNewPageMode && !isScrollReady) {
      window.scrollTo(0, 0);
      setIsScrollReady(true);
    }
  }, [isNewPageMode, isScrollReady]);

  // NEW PAGE MODE SETUP EFFECT
  // When navigating to /{pageId}?new=true, set up the editor for a new page
  // The page is NOT created in the database until the user saves
  useEffect(() => {
    if (!isNewPageMode || !pageId || !user || newPageCreated) {
      return;
    }

    // Extract URL parameters for the new page
    const replyTo = searchParams?.get('replyTo');
    const replyToTitle = searchParams?.get('page');
    // Note: pageUsername is the page owner's username, username is the reply author's username
    // For the reply attribution, we need the page owner's username
    const replyToUsername = searchParams?.get('pageUsername') || searchParams?.get('username');
    const replyType = searchParams?.get('replyType');
    const pageUserId = searchParams?.get('pageUserId');
    const groupId = searchParams?.get('groupId');
    const customDate = searchParams?.get('customDate');
    const urlTitle = searchParams?.get('title');
    const urlContent = searchParams?.get('content');
    const initialContentParam = searchParams?.get('initialContent');
    const pageType = searchParams?.get('type');
    const locationParam = searchParams?.get('location');

    // Build initial title
    let initialTitle = '';
    if (urlTitle && urlTitle.trim()) {
      const trimmed = urlTitle.trim();
      // For daily notes with date format, don't use as title
      if (!(pageType === 'daily-note' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed))) {
        initialTitle = trimmed;
      }
    }

    // Build initial content for replies
    let initialContent: any[] = [{ type: "paragraph", children: [{ text: "" }] }];
    if (replyTo) {
      const decodedTitle = (() => {
        try { return replyToTitle ? decodeURIComponent(replyToTitle) : ''; }
        catch { return replyToTitle || ''; }
      })();
      const decodedUsername = (() => {
        try { return replyToUsername ? decodeURIComponent(replyToUsername) : ''; }
        catch { return replyToUsername || ''; }
      })();

      const sentiment = replyType === 'agree' || replyType === 'disagree' ? replyType : 'standard';

      initialContent = [
        ...createReplyContent({
          pageId: replyTo,
          pageTitle: decodedTitle || "Untitled",
          userId: pageUserId || user?.uid || '',
          username: decodedUsername || "Anonymous",
          replyType: sentiment
        }),
        { type: "paragraph", children: [{ text: "" }] }
      ];
    } else if (urlContent && urlContent.trim()) {
      initialContent = [{ type: "paragraph", children: [{ text: urlContent.trim() }] }];
    } else if (initialContentParam) {
      try {
        initialContent = JSON.parse(decodeURIComponent(initialContentParam));
      } catch {
        // Ignore parse errors
      }
    }

    // Handle custom date from daily notes
    let initialCustomDate: string | null = null;
    if (pageType === 'daily-note' && customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate.trim())) {
      initialCustomDate = customDate.trim();
    } else if (pageType === 'daily-note' && urlTitle && /^\d{4}-\d{2}-\d{2}$/.test(urlTitle.trim())) {
      initialCustomDate = urlTitle.trim();
    }

    // Parse location from URL param (from map flow)
    let initialLocation: Location | null = null;
    if (locationParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(locationParam));
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          initialLocation = {
            lat: parsed.lat,
            lng: parsed.lng,
            zoom: parsed.zoom || 15
          };
        }
      } catch (e) {
        // Failed to parse location param - ignore
      }
    }

    // Set up local state for the new page (NOT saved to database yet)
    const newPageData = {
      id: pageId,
      title: initialTitle,
      content: initialContent,
      userId: user.uid,
      username: user.username || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNewPage: true, // Flag to indicate this is a new unsaved page
      replyTo: replyTo || null,
      replyToTitle: replyToTitle ? decodeURIComponent(replyToTitle) : null,
      replyToUsername: replyToUsername ? decodeURIComponent(replyToUsername) : null,
      groupId: groupId || null,
      customDate: initialCustomDate,
      location: initialLocation
    };

    setPage(newPageData);
    setTitle(initialTitle);
    setEditorState(initialContent);
    setCustomDate(initialCustomDate);
    setLocation(initialLocation);
    setIsLoading(false);
    setNewPageCreated(true);
    isNewPageRef.current = true; // Track new page status via ref to avoid re-renders on first save
  }, [isNewPageMode, pageId, user, newPageCreated, searchParams, setPage, setTitle, setEditorState, setCustomDate, setLocation, setIsLoading, isNewPageRef]);

  return {
    isNewPageMode,
    newPageCreated,
    isClosingNewPage,
    setIsClosingNewPage,
    isScrollReady,
  };
}
