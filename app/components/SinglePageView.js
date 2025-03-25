"use client";
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { app } from "../firebase/config";
import { listenToPageById, getPageVersions } from "../firebase/database";
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
  ChevronDown
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
 * 
 * The component uses several context providers:
 * - PageProvider: For sharing page data with child components
 * 
 * This component has been refactored to use the PageFooter component which contains
 * the PageActions component for all page interactions, replacing the previous
 * PageInteractionButtons and ActionRow components.
 */
export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
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
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Use keyboard shortcuts - moved back to top level
  useKeyboardShortcuts({
    isEditing,
    setIsEditing,
    // Only allow editing if:
    // 1. Page is loaded (!isLoading)
    // 2. Page exists (page !== null)
    // 3. Page is public (isPublic)
    // 4. Page isn't deleted (!isDeleted)
    // 5. User owns the page
    canEdit: Boolean(
      !isLoading &&
      page !== null &&
      isPublic &&
      !isDeleted &&
      user?.uid &&
      page?.userId &&
      user.uid === page.userId
    )
  });

  useEffect(() => {
    if (params.id) {
      setIsLoading(true);
      
      const unsubscribe = listenToPageById(params.id, async (data) => {
        if (data.error) {
          setError(data.error);
          setIsLoading(false);
          return;
        }
        
        let pageData = data.pageData || data;
        
        // Ensure the page has a valid username using our utility function
        pageData = await ensurePageUsername(pageData);
        
        console.log("Page data with ensured username:", pageData);
        
        setPage(pageData);
        setIsPublic(pageData.isPublic || false);
        setGroupId(pageData.groupId || null);
        setGroupName(pageData.groupName || null);
        
        // Set page title for document title
        if (pageData.title) {
          setTitle(pageData.title);
        }
        
        if (data.versionData) {
          try {
            const contentString = data.versionData.content;
            const parsedContent = typeof contentString === 'string' 
              ? JSON.parse(contentString) 
              : contentString;
            
            setEditorState(parsedContent);
          } catch (error) {
            console.error("Error parsing content:", error);
            setEditorState([{ type: "paragraph", children: [{ text: "Error loading content" }] }]);
          }
        }
        
        setIsLoading(false);
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [params.id]);

  useEffect(() => {
    if (page && addRecentPage && Array.isArray(recentPages)) {
      try {
        // Only add to recent pages if it doesn't already exist in the list
        const pageExists = recentPages.some(p => p && p.id === page.id);
        if (!pageExists) {
          addRecentPage(page);
        }
      } catch (error) {
        console.error("Error adding page to recent pages:", error);
        // Don't throw error to prevent app from crashing
      }
    }
  }, [page, addRecentPage, recentPages]);

  const copyLinkToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      
      // Show toast notification
      toast({
        title: "Link copied",
        description: "Page link copied to clipboard",
        variant: "success",
        duration: 2000,
      });
    }
  };

  // Function to handle when page content is fully rendered
  const handlePageFullyRendered = () => {
    setPageFullyRendered(true);
  };

  const Layout = user ? DashboardLayout : PublicLayout;

  // If the page is deleted, show a message
  if (isDeleted) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="text-2xl font-bold mb-4">Page not found</h1>
          <p className="text-muted-foreground mb-6">This page may have been deleted or never existed.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // If the page belongs to a private group and user doesn't have access
  if (groupIsPrivate && !hasGroupAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Private Group Content</h1>
          <p className="text-muted-foreground mb-2">This page belongs to a private group.</p>
          <p className="text-muted-foreground mb-6">You need to be a member of the group to access this content.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (!page) {
    return (
      <Layout>
        <Head>
          <title>Page Not Found - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="min-h-[400px] w-full">
          {isLoading ? (
            <Loader />
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 p-4 rounded-lg max-w-md">
                <h2 className="text-xl font-medium mb-2">Access Error</h2>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-xl font-medium mb-2">Page Not Found</h2>
              <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist or has been removed.</p>
              <Link href="/">
                <Button variant="outline">Return Home</Button>
              </Link>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <Head>
          <title>Loading... - WeWrite</title>
        </Head>
        <PageHeader />
        <Loader />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Head>
          <title>Error - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-text">
            Error
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-5 w-5 text-red-500"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span className="text-lg text-text">
              {error}
            </span>
            <Link href="/">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">
                Go back
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isPublic && (!user || user.uid !== page.userId)) {
    return (
      <Layout>
        <Head>
          <title>Private Page - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-text">
            {title}
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-5 w-5 text-muted-foreground"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span className="text-lg text-muted-foreground">This page is private</span>
            <Link href={user ? "/" : "/auth/login"}>
              <button className="bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
                {user ? "Go back" : "Log in"}
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{title} - WeWrite</title>
      </Head>
      <PageHeader 
        title={isEditing ? "Editing page" : title} 
        username={page?.username || "Anonymous"} 
        userId={page?.userId}
        isLoading={isLoading}
        scrollDirection={scrollDirection}
        groupId={groupId}
        groupName={groupName}
      />
      <div className="pb-24 px-2 sm:px-4 md:px-6">
        {isEditing ? (
          <PageProvider>
            <EditPage
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              page={page}
              title={title}
              setTitle={setTitle}
              current={editorState}
            />
          </PageProvider>
        ) : (
          <>
            <div className="space-y-2 w-full transition-all duration-200 ease-in-out">
              <div className={`page-content ${lineMode === LINE_MODES.DENSE ? 'max-w-full break-words' : ''}`}>
                <PageProvider>
                  <TextView 
                    content={editorState} 
                    viewMode={lineMode}
                    onRenderComplete={handlePageFullyRendered}
                  />
                </PageProvider>
              </div>
            </div>
            
            {/* Page Controls - Only show after content is fully rendered */}
            {pageFullyRendered && (
              <div className="mt-8 flex flex-col gap-4">
                {user && user.uid === page.userId && !isEditing && (
                  <div className="mt-8">
                    {/* ActionRow removed - now using PageFooter with PageActions instead */}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <PageProvider>
        <PageFooter 
          page={page}
          isOwner={user?.uid === page?.userId}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
        />
      </PageProvider>
      <SiteFooter />
    </Layout>
  );
}

// Add to Page Dialog Component
function AddToPageDialog({ open, onOpenChange, pageToAdd }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const { user } = useContext(AuthContext);
  const { recentPages = [], loading: recentPagesLoading } = useContext(RecentPagesContext) || {};
  const { toast } = useToast();
  
  // Search for pages when dialog opens
  useEffect(() => {
    if (open && user) {
      setLoading(true);
      
      // Get pages that the user has edit access to
      const db = getDatabase(app);
      const pagesRef = ref(db, 'pages');
      
      onValue(pagesRef, (snapshot) => {
        const pagesData = snapshot.val();
        if (pagesData) {
          // Filter pages that the user has edit access to (user is the owner)
          const userPages = Object.entries(pagesData)
            .map(([id, page]) => ({ id, ...page }))
            .filter(page => 
              // Only include pages the user owns
              page.userId === user.uid && 
              // Exclude the current page
              pageToAdd && page.id !== pageToAdd.id
            )
            .sort((a, b) => {
              // Sort by last modified date (newest first)
              const aDate = a.lastModified || 0;
              const bDate = b.lastModified || 0;
              return bDate - aDate;
            });
          
          setPages(userPages);
        } else {
          setPages([]);
        }
        setLoading(false);
      });
    }
  }, [open, user, pageToAdd]);
  
  // Filter pages based on search query
  const filteredPages = searchQuery.trim() === '' 
    ? pages 
    : pages.filter(page => 
        (page.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase())
      );
  
  // Get recently viewed pages that are not the current page
  const filteredRecentPages = (recentPages || [])
    .filter(page => page && page.id !== (pageToAdd?.id || ''))
    .slice(0, 5); // Show only the 5 most recent pages
  
  const handleAddToPage = async () => {
    if (!selectedPage || !pageToAdd) return;
    
    try {
      // Get the content of the selected page
      const db = getDatabase(app);
      const pageRef = ref(db, `pages/${selectedPage.id}`);
      
      onValue(pageRef, (snapshot) => {
        const targetPage = snapshot.val();
        if (!targetPage) {
          toast({
            title: "Error",
            description: "Selected page not found",
            variant: "destructive"
          });
          return;
        }
        
        // Parse the content
        let targetContent;
        try {
          targetContent = typeof targetPage.content === 'string' 
            ? JSON.parse(targetPage.content) 
            : targetPage.content;
        } catch (error) {
          console.error("Error parsing target page content:", error);
          targetContent = [];
        }
        
        if (!Array.isArray(targetContent)) {
          targetContent = [];
        }
        
        // Parse the content of the page to add
        let sourceContent;
        try {
          sourceContent = typeof pageToAdd.content === 'string' 
            ? JSON.parse(pageToAdd.content) 
            : pageToAdd.content;
        } catch (error) {
          console.error("Error parsing source page content:", error);
          sourceContent = [];
        }
        
        if (!Array.isArray(sourceContent)) {
          sourceContent = [];
        }
        
        // Add a divider and reference to the source page
        targetContent.push({
          type: "thematicBreak",
          children: [{ text: "" }]
        });
        
        targetContent.push({
          type: "paragraph",
          children: [
            { text: "Added from " },
            {
              type: "link",
              url: `/pages/${pageToAdd.id}`,
              children: [{ text: pageToAdd.title || "Untitled" }]
            },
            { text: ` by ${pageToAdd.username || "Anonymous"}` }
          ]
        });
        
        // Add the content from the source page
        targetContent = [...targetContent, ...sourceContent];
        
        // Update the page
        const updates = {};
        updates[`pages/${selectedPage.id}/content`] = JSON.stringify(targetContent);
        updates[`pages/${selectedPage.id}/lastModified`] = Date.now();
        
        const dbRef = ref(db);
        update(dbRef, updates)
          .then(() => {
            toast({
              title: "Success",
              description: `Content added to "${selectedPage.title || 'Untitled'}"`,
            });
            onOpenChange(false);
          })
          .catch((error) => {
            console.error("Error updating page:", error);
            toast({
              title: "Error",
              description: "Failed to add content to page",
              variant: "destructive"
            });
          });
      }, { onlyOnce: true });
    } catch (error) {
      console.error("Error in handleAddToPage:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Page</DialogTitle>
          <DialogDescription>
            Select a page to add the current content to
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Command className="rounded-lg border shadow-md">
            <CommandInput 
              placeholder="Search pages..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No pages found</CommandEmpty>
              
              {/* Recently Viewed Pages */}
              {filteredRecentPages.length > 0 && !searchQuery && (
                <CommandGroup heading="Recently Viewed">
                  {recentPagesLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="ml-2">Loading recent pages...</span>
                    </div>
                  ) : (
                    filteredRecentPages.map(page => (
                      <CommandItem
                        key={page.id}
                        value={`recent-${page.id}`}
                        onSelect={() => {
                          // Find the full page data from pages array
                          const fullPage = pages.find(p => p.id === page.id);
                          setSelectedPage(fullPage || page);
                        }}
                        className={`flex items-center justify-between ${selectedPage?.id === page.id ? 'bg-accent' : ''}`}
                      >
                        <div className="flex flex-col">
                          <span>{page.title || 'Untitled'}</span>
                          <span className="text-xs text-muted-foreground">
                            Recently viewed
                          </span>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              )}
              
              {/* All Pages */}
              <CommandGroup heading="Your Pages">
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading pages...</span>
                  </div>
                ) : (
                  filteredPages.map(page => (
                    <CommandItem
                      key={page.id}
                      value={page.id}
                      onSelect={() => setSelectedPage(page)}
                      className={`flex items-center justify-between ${selectedPage?.id === page.id ? 'bg-accent' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span>{page.title || 'Untitled'}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(page.lastModified || 0).toLocaleDateString()}
                        </span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleAddToPage} 
            disabled={!selectedPage || loading}
          >
            Add to Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
