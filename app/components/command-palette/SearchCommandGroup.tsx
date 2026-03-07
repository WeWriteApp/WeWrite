'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CommandGroup, CommandItem } from '../ui/command';
import { Icon } from '@/components/ui/Icon';
import { PillLink } from '../utils/PillLink';
import { useUnifiedSearch, SEARCH_CONTEXTS } from '../../hooks/useUnifiedSearch';
import { useAuth } from '../../providers/AuthProvider';
import { LinkLocationContext } from '../../providers/CommandPaletteProvider';
import { buildNewPageUrl } from '../../utils/pageId';
import { addRecentSearch } from '../../utils/recentSearches';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { getCollectionName } from '../../utils/environmentConfig';

interface SearchCommandGroupProps {
  query: string;
  onSelect: (action: () => void) => void;
  locationContext?: LinkLocationContext | null;
}

export default function SearchCommandGroup({ query, onSelect, locationContext }: SearchCommandGroupProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { results, isLoading, debouncedSearch, clearSearch, searchStats } = useUnifiedSearch(user?.uid || null, {
    context: SEARCH_CONTEXTS.COMMAND_PALETTE,
    includeUsers: true,
    titleOnly: true,
    maxResults: 20,
  });

  const lastQueryRef = React.useRef('');

  React.useEffect(() => {
    if (query.length >= 2 && query !== lastQueryRef.current) {
      lastQueryRef.current = query;
      debouncedSearch(query);
    } else if (query.length < 2 && lastQueryRef.current) {
      lastQueryRef.current = '';
      clearSearch();
    }
  }, [query, debouncedSearch, clearSearch]);

  // Log search performance in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && searchStats.source) {
      console.log(`[CommandPalette Search] engine=${searchStats.source}, time=${searchStats.searchTimeMs}ms, pages=${searchStats.pagesFound}, users=${searchStats.usersFound}`);
    }
  }, [searchStats]);


  if (query.length < 2) return null;

  const hasResults = results.pages.length > 0 || results.users.length > 0;

  const selectAndSave = (action: () => void) => {
    addRecentSearch(query, user?.uid ?? null);
    onSelect(action);
  };

  const handleLinkPageToLocation = async (pageId: string) => {
    if (!locationContext) return;
    try {
      const pageRef = doc(db, getCollectionName('pages'), pageId);
      await updateDoc(pageRef, {
        location: {
          lat: locationContext.lat,
          lng: locationContext.lng,
          zoom: locationContext.zoom,
        },
      });
      router.push('/map');
    } catch (error) {
      console.error('Failed to link page to location:', error);
    }
  };

  // Combine users and pages into a single sorted list by matchScore
  type SearchResultItem =
    | { type: 'user'; data: (typeof results.users)[number] }
    | { type: 'page'; data: (typeof results.pages)[number] };

  const sortedResults: SearchResultItem[] = React.useMemo(() => {
    const items: SearchResultItem[] = [
      ...results.users.map((u) => ({ type: 'user' as const, data: u })),
      ...results.pages.map((p) => ({ type: 'page' as const, data: p })),
    ];
    items.sort((a, b) => (b.data.matchScore ?? 0) - (a.data.matchScore ?? 0));
    return items;
  }, [results.users, results.pages]);

  return (
    <CommandGroup heading="Search Results">
      {isLoading && !hasResults && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Icon name="Loader" size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Searching...</span>
        </div>
      )}
      {sortedResults.map((item) => {
        if (item.type === 'user') {
          const u = item.data;
          return (
            <CommandItem
              key={`user-${u.id}`}
              value={`search-user-${u.id}-${u.username}`}
              onSelect={() => selectAndSave(() => router.push(`/u/${u.id}`))}
            >
              <Icon name="User" size={16} className="mr-2 shrink-0" />
              <span>{u.username}</span>
            </CommandItem>
          );
        }
        const page = item.data;
        return (
          <CommandItem
            key={`page-${page.id}`}
            value={`search-page-${page.id}-${page.title}`}
            onSelect={() => {
              if (locationContext) {
                selectAndSave(() => handleLinkPageToLocation(page.id));
              } else {
                selectAndSave(() => router.push(`/${page.id}`));
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <PillLink
                href={`/${page.id}`}
                isPublic={page.isPublic}
                isOwned={page.userId === user?.uid}
                clickable={false}
                className="pointer-events-none"
              >
                {page.title || 'Untitled'}
              </PillLink>
              {page.username && (
                <span className="text-xs text-muted-foreground truncate shrink-0">by {page.username}</span>
              )}
            </div>
            {locationContext && (
              <Icon name="MapPin" size={14} className="ml-auto shrink-0 text-muted-foreground" />
            )}
          </CommandItem>
        );
      })}

      {/* Create new page action */}
      {!isLoading && (
        <CommandItem
          value={`search-create-new-page-${query}`}
          onSelect={() => selectAndSave(() => router.push(buildNewPageUrl({ title: query })))}
        >
          <Icon name="Plus" size={16} className="mr-2 shrink-0" />
          <span>Create new page &ldquo;{query}&rdquo;</span>
        </CommandItem>
      )}

      {/* No results state */}
      {!isLoading && !hasResults && (
        <CommandItem disabled value="search-no-results">
          <span className="text-muted-foreground">No pages or users found</span>
        </CommandItem>
      )}
    </CommandGroup>
  );
}
