"use client";
import React, { useEffect, useState, useContext } from "react";
import { useParams } from "next/navigation";
import { listenToPageById } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { RecentPagesContext, useRecentPages } from "../contexts/RecentPagesContext";
import { useLineSettings } from "../contexts/LineSettingsContext";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import SiteFooter from "./SiteFooter";
import EditPage from "./EditPage";
import TextView from "./TextView";
import { Loader, AlertTriangle } from "lucide-react";
import Head from "next/head";

// Import PageProvider from the original module
import { PageProvider, usePage } from "../contexts/PageContext";

// Re-export the usePage hook
export { usePage };

// Define Page interface directly to avoid import issues
interface Page {
  id: string;
  title: string;
  isPublic: boolean;
  userId: string;
  username?: string;
  authorName?: string;
  lastModified?: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
  content?: any[];
}

// Define RecentPagesContextType to match the actual implementation
interface RecentPagesContextType {
  recentPages: any[];
  loading: boolean;
  addRecentPage: (page: any) => void;
}

interface SinglePageViewProps {
  params: {
    id?: string;
  };
}

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
 */
function SinglePageView({ params }: SinglePageViewProps) {
  const [page, setPage] = useState<Page | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState<any[]>([]);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  
  const { user } = useContext(AuthContext);
  const recentPagesContext = useContext(RecentPagesContext) as RecentPagesContextType;
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
        setPage(pageData);
        setEditorState(pageData.content || []);
        setIsPublic(pageData.isPublic || false);
        setGroupId(pageData.groupId || null);
        setGroupName(pageData.groupName || null);
        setTitle(pageData.title || 'Untitled');
        
        // Add to recent pages (if context exists)
        if (recentPagesContext && typeof recentPagesContext.addRecentPage === 'function') {
          (recentPagesContext.addRecentPage as Function)({
            id: params.id,
            title: pageData.title || 'Untitled',
            lastModified: pageData.lastModified || new Date().toISOString()
          });
        }
        
      } catch (err) {
        console.error('Error processing page data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [params?.id]);

  const handleRenderComplete = () => {
    console.log('Page render complete');
  };

  return (
    <PageProvider>
      <div className="min-h-screen bg-background">
        <Head>
          <title>{title ? `${title} - WeWrite` : 'WeWrite'}</title>
        </Head>

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
              <PageHeader 
                title={title || ''}
                username={page?.username}
                userId={page?.userId}
                isLoading={false}
                groupId={groupId || undefined}
                groupName={groupName || undefined}
              />

              {isEditing ? (
                <EditPage 
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  page={page}
                  current={editorState}
                  title={title || ''}
                  setTitle={setTitle}
                  editorError={null}
                />
              ) : (
                <TextView 
                  content={editorState || []}
                  viewMode={lineMode}
                  onRenderComplete={handleRenderComplete}
                  isSearch={false}
                />
              )}

              <PageFooter
                pageId={params.id || ''}
                isPublic={isPublic}
                isEditing={isEditing}
                onEdit={() => setIsEditing(true)}
                scrollDirection={scrollDirection}
                isScrolled={isScrolled}
              />
            </>
          )}
        </div>

        <SiteFooter className="mt-auto" />
      </div>
    </PageProvider>
  );
}

export default SinglePageView;
