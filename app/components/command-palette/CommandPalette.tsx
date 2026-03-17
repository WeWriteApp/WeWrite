'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '../ui/command';
import { Icon, IconName } from '@/components/ui/Icon';
import { useCommandPalette } from '../../providers/CommandPaletteProvider';
import { useCommandPaletteActions } from '../../contexts/CommandPaletteActionsContext';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import { useSettingsSections } from '../../hooks/useSettingsSections';
import { useAuth } from '../../providers/AuthProvider';
import { useHasKeyboard } from '../../hooks/useHasKeyboard';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';
import { useMediaQuery } from '../../hooks/use-media-query';
import { buildNewPageUrl } from '../../utils/pageId';
import { navigateToRandomPage } from '../../utils/randomPageNavigation';
import { getRecentSearches, removeRecentSearch, clearRecentSearches } from '../../utils/recentSearches';
import { getSavedSearches, deleteSavedSearch } from '../../utils/savedSearches';
import { addRecentSearch } from '../../utils/recentSearches';
import AdminCommandGroup from './AdminCommandGroup';
import SearchCommandGroup from './SearchCommandGroup';
import CollapsibleCommandGroup from './CollapsibleCommandGroup';

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true;
  return value.toLowerCase().includes(query.toLowerCase());
}

interface RecentSearchItem {
  term: string;
  timestamp: number;
}

interface SavedSearchItem {
  term: string;
  timestamp: number;
}

export default function CommandPalette() {
  const { isOpen, inputValue, setInputValue, linkLocationContext, closePalette } = useCommandPalette();
  const { pageActions } = useCommandPaletteActions();
  const navigationItems = useNavigationItems();
  const { sections: settingsSections } = useSettingsSections();
  const { user, signOut } = useAuth();
  const hasKeyboard = useHasKeyboard();
  const router = useRouter();
  const { openDrawer } = useGlobalDrawer();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isUserAdmin = user?.isAdmin === true;

  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);

  // Load recent & saved searches when palette opens
  useEffect(() => {
    if (!isOpen) return;
    const loadSearches = async () => {
      const recent = await getRecentSearches(user?.uid ?? null);
      setRecentSearches(recent.slice(0, 5));
      const saved = getSavedSearches(user?.uid ?? null);
      setSavedSearches(saved);
    };
    loadSearches();
  }, [isOpen, user?.uid]);

  const runAction = useCallback((action: () => void) => {
    closePalette();
    requestAnimationFrame(action);
  }, [closePalette]);

  const navigateTo = useCallback((href: string) => {
    runAction(() => router.push(href));
  }, [runAction, router]);

  const openSettingsSection = useCallback((sectionId: string) => {
    if (isDesktop) {
      navigateTo(`/settings/${sectionId}`);
    } else {
      runAction(() => openDrawer('settings', `settings/${sectionId}`));
    }
  }, [isDesktop, navigateTo, runAction, openDrawer]);

  const openAdminSection = useCallback((sectionId: string) => {
    if (isDesktop) {
      navigateTo(`/admin/${sectionId}`);
    } else {
      runAction(() => openDrawer('admin', `admin/${sectionId}`));
    }
  }, [isDesktop, navigateTo, runAction, openDrawer]);

  const handleLogout = useCallback(() => {
    runAction(async () => {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        await signOut();
      }
    });
  }, [runAction, signOut]);

  const handleSearchSelect = useCallback((term: string) => {
    setInputValue(term);
  }, [setInputValue]);

  const handleRemoveRecent = useCallback(async (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeRecentSearch(term, user?.uid ?? null);
    setRecentSearches((prev) => prev.filter((s) => s.term !== term));
  }, [user?.uid]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches(user?.uid ?? null);
    setRecentSearches([]);
  }, [user?.uid]);

  const handleRemoveSaved = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSavedSearch(index, user?.uid ?? null);
    setSavedSearches((prev) => prev.filter((_, i) => i !== index));
  }, [user?.uid]);

  const isSearching = (inputValue ?? '').trim().length >= 2;
  const hasInput = (inputValue ?? '').trim().length > 0;

  // Filter navigation items by query
  const filteredNavItems = useMemo(() => {
    if (!inputValue) return navigationItems;
    return navigationItems.filter((item) =>
      matchesQuery(`nav ${item.label} ${item.keywords?.join(' ') ?? ''}`, inputValue)
    );
  }, [navigationItems, inputValue]);

  // Filter settings sections by query
  const filteredSettings = useMemo(() => {
    if (!inputValue) return settingsSections;
    return settingsSections.filter((section) =>
      matchesQuery(`settings ${section.title}`, inputValue)
    );
  }, [settingsSections, inputValue]);

  // Filter action items
  const actionItems = useMemo(() => {
    const items = [
      { value: 'create new page write', label: 'Create New Page', icon: 'Plus' as IconName, onSelect: () => runAction(() => router.push(buildNewPageUrl())) },
      { value: 'go to random page surprise discover', label: 'Go to Random Page', icon: 'Shuffle' as IconName, onSelect: () => runAction(() => navigateToRandomPage(router, user?.uid)) },
      { value: 'log out sign out', label: 'Log Out', icon: 'LogOut' as IconName, onSelect: handleLogout },
    ];
    if (!inputValue) return items;
    return items.filter((item) => matchesQuery(item.value, inputValue));
  }, [inputValue, runAction, router, user?.uid, handleLogout]);

  if (!user) return null;

  const isEditing = pageActions?.isEditing ?? false;

  // Check if page action items match query
  const pageActionMatches = (value: string) => !inputValue || matchesQuery(value, inputValue);

  const showRecentSearches = !hasInput && recentSearches.length > 0;
  const showSavedSearches = !hasInput && savedSearches.length > 0;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && closePalette()}
      shouldFilter={false}
      hashId="command-palette"
    >
      <CommandInput
        placeholder={linkLocationContext ? "Search for a page to link to this location..." : "Search pages, users, or type a command..."}
        value={inputValue}
        onValueChange={setInputValue}
        onClear={() => {
          if (inputValue) {
            setInputValue('');
          } else {
            closePalette();
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No commands or results found.</CommandEmpty>

        {/* Recent Searches — shown when no input */}
        {showRecentSearches && (
          <>
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search) => (
                <CommandItem
                  key={`recent-${search.term}`}
                  value={`recent-search-${search.term}`}
                  onSelect={() => handleSearchSelect(search.term)}
                >
                  <Icon name="Clock" size={14} className="mr-2 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{search.term}</span>
                  <button
                    className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted"
                    onClick={(e) => handleRemoveRecent(search.term, e)}
                    aria-label={`Remove "${search.term}" from recent searches`}
                  >
                    <Icon name="X" size={12} className="text-muted-foreground" />
                  </button>
                </CommandItem>
              ))}
              <CommandItem
                value="__clear-recent-searches"
                onSelect={handleClearRecent}
                className="justify-center text-muted-foreground"
              >
                <span className="text-xs">Clear recent searches</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Saved Searches — shown when no input */}
        {showSavedSearches && (
          <>
            <CommandGroup heading="Saved Searches">
              {savedSearches.map((search, index) => (
                <CommandItem
                  key={`saved-${search.term}`}
                  value={`saved-search-${search.term}`}
                  onSelect={() => handleSearchSelect(search.term)}
                >
                  <Icon name="Pin" size={14} className="mr-2 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{search.term}</span>
                  <button
                    className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted"
                    onClick={(e) => handleRemoveSaved(index, e)}
                    aria-label={`Remove "${search.term}" from saved searches`}
                  >
                    <Icon name="X" size={12} className="text-muted-foreground" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {filteredNavItems.length > 0 && (
          <CollapsibleCommandGroup heading="Navigation" initialCount={hasInput ? filteredNavItems.length : 5}>
            {filteredNavItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`nav ${item.label} ${item.keywords?.join(' ') ?? ''}`}
                onSelect={() => {
                  if (item.action) {
                    runAction(item.action);
                  } else {
                    navigateTo(item.href);
                  }
                }}
              >
                <Icon name={item.icon as IconName} size={16} className="mr-2 shrink-0" />
                <span>Go to {item.label}</span>
              </CommandItem>
            ))}
          </CollapsibleCommandGroup>
        )}

        {filteredNavItems.length > 0 && <CommandSeparator />}

        {/* Settings */}
        {filteredSettings.length > 0 && (
          <CollapsibleCommandGroup heading="Settings" initialCount={hasInput ? filteredSettings.length : 3}>
            {filteredSettings.map((section) => (
              <CommandItem
                key={section.id}
                value={`settings ${section.title}`}
                onSelect={() => openSettingsSection(section.id)}
              >
                <section.icon className="mr-2 shrink-0" />
                <span>{section.title}</span>
              </CommandItem>
            ))}
          </CollapsibleCommandGroup>
        )}

        {filteredSettings.length > 0 && <CommandSeparator />}

        {/* Admin (only for admins) */}
        {isUserAdmin && (
          <>
            <AdminCommandGroup onSelectSection={openAdminSection} inputValue={inputValue} />
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {actionItems.length > 0 && (
          <CommandGroup heading="Actions">
            {actionItems.map((item) => (
              <CommandItem key={item.value} value={item.value} onSelect={item.onSelect}>
                <Icon name={item.icon} size={16} className="mr-2 shrink-0" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Page Actions (when viewing a page, not editing) */}
        {pageActions && !isEditing && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Page: ${pageActions.pageTitle || 'Current Page'}`}>
              {pageActions.canEdit && pageActions.onEdit && pageActionMatches('edit page') && (
                <CommandItem
                  value="edit page"
                  onSelect={() => runAction(pageActions.onEdit!)}
                >
                  <Icon name="Pencil" size={16} className="mr-2 shrink-0" />
                  <span>Edit Page</span>
                </CommandItem>
              )}
              {pageActions.onReply && pageActionMatches('reply to page') && (
                <CommandItem
                  value="reply to page"
                  onSelect={() => runAction(pageActions.onReply!)}
                >
                  <Icon name="Reply" size={16} className="mr-2 shrink-0" />
                  <span>Reply to Page</span>
                </CommandItem>
              )}
              {pageActions.onCopyLink && pageActionMatches('copy link share') && (
                <CommandItem
                  value="copy link share"
                  onSelect={() => runAction(pageActions.onCopyLink!)}
                >
                  <Icon name="Link" size={16} className="mr-2 shrink-0" />
                  <span>Copy Link</span>
                </CommandItem>
              )}
              {pageActions.onToggleParagraphMode && pageActionMatches('toggle paragraph dense mode') && (
                <CommandItem
                  value="toggle paragraph dense mode"
                  onSelect={() => runAction(pageActions.onToggleParagraphMode!)}
                >
                  <Icon name="FileText" size={16} className="mr-2 shrink-0" />
                  <span>Toggle Paragraph Mode</span>
                </CommandItem>
              )}
              {pageActions.isOwner && pageActions.onDelete && pageActionMatches('delete page') && (
                <CommandItem
                  value="delete page"
                  onSelect={() => runAction(pageActions.onDelete!)}
                >
                  <Icon name="Trash2" size={16} className="mr-2 shrink-0" />
                  <span>Delete Page</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        {/* Editor Actions (when editing a page) */}
        {pageActions && isEditing && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Editor">
              {pageActions.onInsertLink && pageActionMatches('insert link') && (
                <CommandItem
                  value="insert link"
                  onSelect={() => runAction(pageActions.onInsertLink!)}
                >
                  <Icon name="Link" size={16} className="mr-2 shrink-0" />
                  <span>Insert Link</span>
                  {hasKeyboard && <CommandShortcut>Cmd+K</CommandShortcut>}
                </CommandItem>
              )}
              {pageActions.onAddLocation && pageActionMatches('add location map') && (
                <CommandItem
                  value="add location map"
                  onSelect={() => runAction(pageActions.onAddLocation!)}
                >
                  <Icon name="MapPin" size={16} className="mr-2 shrink-0" />
                  <span>Add Location</span>
                </CommandItem>
              )}
              {pageActions.onSave && pageActionMatches('save page') && (
                <CommandItem
                  value="save page"
                  onSelect={() => runAction(pageActions.onSave!)}
                  disabled={pageActions.isSaving}
                >
                  <Icon name="Check" size={16} className="mr-2 shrink-0" />
                  <span>{pageActions.isSaving ? 'Saving...' : 'Save'}</span>
                  {hasKeyboard && <CommandShortcut>Cmd+S</CommandShortcut>}
                </CommandItem>
              )}
              {pageActions.onCancel && pageActionMatches('cancel discard') && (
                <CommandItem
                  value="cancel discard"
                  onSelect={() => runAction(pageActions.onCancel!)}
                >
                  <Icon name="X" size={16} className="mr-2 shrink-0" />
                  <span>Cancel Editing</span>
                  {hasKeyboard && <CommandShortcut>Esc</CommandShortcut>}
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        {/* Search Results - shown when query >= 2 chars */}
        {isSearching && (
          <>
            <CommandSeparator />
            <SearchCommandGroup
              query={inputValue.trim()}
              onSelect={runAction}
              locationContext={linkLocationContext}
            />
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
