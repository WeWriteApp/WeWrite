'use client';

import React, { useCallback } from 'react';
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
import AdminCommandGroup from './AdminCommandGroup';

export default function CommandPalette() {
  const { isOpen, closePalette } = useCommandPalette();
  const { pageActions } = useCommandPaletteActions();
  const navigationItems = useNavigationItems();
  const { sections: settingsSections } = useSettingsSections();
  const { user, signOut } = useAuth();
  const hasKeyboard = useHasKeyboard();
  const router = useRouter();
  const { openDrawer } = useGlobalDrawer();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isUserAdmin = user?.isAdmin === true;

  const runAction = useCallback((action: () => void) => {
    closePalette();
    // Small delay so the dialog close animation doesn't interfere with navigation
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

  if (!user) return null;

  const isEditing = pageActions?.isEditing ?? false;

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && closePalette()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
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
        </CommandGroup>

        <CommandSeparator />

        {/* Settings */}
        <CommandGroup heading="Settings">
          {settingsSections.map((section) => (
            <CommandItem
              key={section.id}
              value={`settings ${section.title}`}
              onSelect={() => openSettingsSection(section.id)}
            >
              <section.icon className="mr-2 shrink-0" />
              <span>{section.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Admin (only for admins) */}
        {isUserAdmin && (
          <>
            <AdminCommandGroup onSelectSection={openAdminSection} />
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="create new page write"
            onSelect={() => runAction(() => router.push(buildNewPageUrl()))}
          >
            <Icon name="Plus" size={16} className="mr-2 shrink-0" />
            <span>Create New Page</span>
          </CommandItem>
          <CommandItem
            value="go to random page surprise discover"
            onSelect={() => runAction(() => navigateToRandomPage(router, user?.uid))}
          >
            <Icon name="Shuffle" size={16} className="mr-2 shrink-0" />
            <span>Go to Random Page</span>
          </CommandItem>
          <CommandItem
            value="search find"
            onSelect={() => navigateTo('/search')}
          >
            <Icon name="Search" size={16} className="mr-2 shrink-0" />
            <span>Search</span>
            {hasKeyboard && <CommandShortcut>/</CommandShortcut>}
          </CommandItem>
          <CommandItem
            value="log out sign out"
            onSelect={handleLogout}
          >
            <Icon name="LogOut" size={16} className="mr-2 shrink-0" />
            <span>Log Out</span>
          </CommandItem>
        </CommandGroup>

        {/* Page Actions (when viewing a page, not editing) */}
        {pageActions && !isEditing && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Page: ${pageActions.pageTitle || 'Current Page'}`}>
              {pageActions.canEdit && pageActions.onEdit && (
                <CommandItem
                  value="edit page"
                  onSelect={() => runAction(pageActions.onEdit!)}
                >
                  <Icon name="Pencil" size={16} className="mr-2 shrink-0" />
                  <span>Edit Page</span>
                </CommandItem>
              )}
              {pageActions.onReply && (
                <CommandItem
                  value="reply to page"
                  onSelect={() => runAction(pageActions.onReply!)}
                >
                  <Icon name="Reply" size={16} className="mr-2 shrink-0" />
                  <span>Reply to Page</span>
                </CommandItem>
              )}
              {pageActions.onCopyLink && (
                <CommandItem
                  value="copy link share"
                  onSelect={() => runAction(pageActions.onCopyLink!)}
                >
                  <Icon name="Link" size={16} className="mr-2 shrink-0" />
                  <span>Copy Link</span>
                </CommandItem>
              )}
              {pageActions.onToggleParagraphMode && (
                <CommandItem
                  value="toggle paragraph dense mode"
                  onSelect={() => runAction(pageActions.onToggleParagraphMode!)}
                >
                  <Icon name="FileText" size={16} className="mr-2 shrink-0" />
                  <span>Toggle Paragraph Mode</span>
                </CommandItem>
              )}
              {pageActions.isOwner && pageActions.onDelete && (
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
              {pageActions.onInsertLink && (
                <CommandItem
                  value="insert link"
                  onSelect={() => runAction(pageActions.onInsertLink!)}
                >
                  <Icon name="Link" size={16} className="mr-2 shrink-0" />
                  <span>Insert Link</span>
                  {hasKeyboard && <CommandShortcut>Cmd+K</CommandShortcut>}
                </CommandItem>
              )}
              {pageActions.onAddLocation && (
                <CommandItem
                  value="add location map"
                  onSelect={() => runAction(pageActions.onAddLocation!)}
                >
                  <Icon name="MapPin" size={16} className="mr-2 shrink-0" />
                  <span>Add Location</span>
                </CommandItem>
              )}
              {pageActions.onSave && (
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
              {pageActions.onCancel && (
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
      </CommandList>
    </CommandDialog>
  );
}
