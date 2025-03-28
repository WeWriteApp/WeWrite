"use client";
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { app } from "../firebase/config";
import { listenToPageById, getPageVersions } from "../firebase/database";
import { updateBacklinks } from "../firebase/backlinks";
import { AuthContext } from "../providers/AuthProvider";
import { DataContext } from "../providers/DataProvider";
import { createEditor } from "slate";
import { withHistory } from "slate-history";
import { Slate, Editable, withReact } from "slate-react";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import SiteFooter from "./SiteFooter";
import Link from "next/link";
import Head from "next/head";
import { Button } from "./ui/button";
import { EditorContent } from "./SlateEditor";
import TextView from "./TextView";
import { 
  Loader, 
  Lock, 
  Unlock, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { toast } from "sonner";
import { RecentPagesContext } from "../contexts/RecentPagesContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { PageProvider } from "../contexts/PageContext";
import { useLineSettings, LINE_MODES } from "../contexts/LineSettingsContext";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogClose 
} from './ui/dialog';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from './ui/command';
import EditPage from "./EditPage";
import { ensurePageUsername } from "../utils/userUtils";
import BacklinksSection from "./BacklinksSection";

/**
 * SinglePageView Component
 * 
 * This component is responsible for displaying a single page with all its content and interactive elements.
 * It handles:
 * - Loading and displaying page content
 * - Editing functionality for page owners
 * - Page visibility controls (public/private)
 * - Keyboard shortcuts for navigation and editing
 * - Page interactions through the PageFooter component
 * - Backlinks tracking and display
 * 
 * The component uses several context providers:
 * - PageProvider: For sharing page data with child components
 * 
 * This component has been refactored to use the PageFooter component which contains
 * the PageActions component for all page interactions, replacing the previous
 * PageInteractionButtons and ActionRow components.
 */
function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
  const [editorError, setEditorError] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [groupName, setGroupName] = useState(null);
  const [groupIsPrivate, setGroupIsPrivate] = useState(false);
  const [hasGroupAccess, setHasGroupAccess] = useState(true);
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState(null);
  const [pageFullyRendered, setPageFullyRendered] = useState(false);
  const [title, setTitle] = useState(null);
  const { user } = useContext(AuthContext);
  const { recentPages = [], addRecentPage } = useContext(RecentPagesContext) || {};
  const { lineMode } = useLineSettings();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine scroll direction
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }
      
      // Update last scroll position
      setLastScrollY(currentScrollY);
      
      // Set scrolled state
      setIsScrolled(currentScrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (!params?.id) {
      setError('No page ID provided');
      setIsLoading(false);
      return;
    }

    const unsubscribe = listenToPageById(params.id, async (pageData) => {
      if (!pageData) {
        setIsDeleted(true);
        setIsLoading(false);
        return;
      }

      try {
        const username = await ensurePageUsername(pageData);
        setPage({ ...pageData, username });
        setEditorState(pageData.content || []);
        setIsPublic(pageData.isPublic || false);
        setGroupId(pageData.groupId || null);
        setGroupName(pageData.groupName || null);
        setTitle(pageData.title || 'Untitled');
        
        // Update backlinks when content changes
        if (pageData.content) {
          await updateBacklinks(params.id, pageData.content);
        }
        
        // Add to recent pages
        if (addRecentPage) {
          addRecentPage({
            id: params.id,
            title: pageData.title || 'Untitled',
            lastModified: pageData.lastModified || new Date().toISOString()
          });
        }
        
      } catch (err) {
        console.error('Error processing page data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [params?.id, addRecentPage]);

  // Rest of the component implementation...

  return (
    <PageProvider value={{ page, isEditing, setIsEditing }}>
      <div className="min-h-screen bg-background">
        <Head>
          <title>{title ? `${title} - WeWrite` : 'WeWrite'}</title>
        </Head>

        {/* Page Content */}
        <div className="container max-w-4xl mx-auto px-4 pb-32">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <Loader className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium text-destructive">{error}</p>
            </div>
          ) : isDeleted ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium">This page has been deleted</p>
            </div>
          ) : (
            <>
              {/* Page Header */}
              <PageHeader 
                title={title}
                isPublic={isPublic}
                isEditing={isEditing}
                groupName={groupName}
                username={page?.username}
                lastModified={page?.lastModified}
              />

              {/* Editor or TextView */}
              {isEditing ? (
                <EditPage 
                  pageId={params.id}
                  initialContent={editorState}
                  onSave={() => setIsEditing(false)}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <TextView content={editorState} />
              )}

              {/* Backlinks Section */}
              {!isEditing && <BacklinksSection pageId={params.id} />}

              {/* Page Footer */}
              <PageFooter
                pageId={params.id}
                isPublic={isPublic}
                isEditing={isEditing}
                onEdit={() => setIsEditing(true)}
                scrollDirection={scrollDirection}
                isScrolled={isScrolled}
              />
            </>
          )}
        </div>

        {/* Site Footer */}
        <SiteFooter />
      </div>
    </PageProvider>
  );
}

export default SinglePageView;
