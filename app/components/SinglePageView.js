"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import TextView from "./TextView";
import { Loader } from "./Loader";
import Link from "next/link";
import { AuthContext } from "../providers/AuthProvider";
import EditPage from "./EditPage";
import ActionRow from "./PageActionRow";
import { listenToPageById } from "../firebase/database";
import PledgeBar from "./PledgeBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import Head from "next/head";
import PageHeader from "./PageHeader";
import { getDatabase, ref, onValue } from "firebase/database";
import { app } from "../firebase/config";
import { LoggingProvider } from "../providers/LoggingProvider";
import { PageProvider } from "../contexts/PageContext";
import { LineSettingsProvider } from '../contexts/LineSettingsContext';
import { useRouter } from 'next/navigation';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from './ui/dialog';
import { Button } from './ui/button';
import { Reply, Plus } from 'lucide-react';
import { LinkIcon } from 'lucide-react';
import { useToast } from './ui/use-toast';

export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [lineViewMode, setLineViewMode] = useState('normal');
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const storedMode = localStorage.getItem('pageViewMode');
    if (storedMode && ['dense', 'spaced', 'normal'].includes(storedMode)) {
      setLineViewMode(storedMode);
    }

    const handleStorageChange = (e) => {
      if (e.key === 'pageViewMode' && ['dense', 'spaced', 'normal'].includes(e.newValue)) {
        setLineViewMode(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentMode = localStorage.getItem('pageViewMode');
      if (currentMode && currentMode !== lineViewMode && ['dense', 'spaced', 'normal'].includes(currentMode)) {
        setLineViewMode(currentMode);
      }
    }, 1000); // Check every second

    return () => clearInterval(intervalId);
  }, [lineViewMode]);

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
    // Setup listener for real-time updates
    const unsubscribe = listenToPageById(params.id, async (data) => {
      if (data && data.error) {
        // Handle access denied or other errors
        setIsLoading(false);
        setPage(null);
        setError(typeof data.error === 'object' ? data.error.error : data.error);
        return;
      }
      
      if (data && data.pageData) {
        const { pageData, versionData, links } = data;

        // Get user data from Firebase Realtime Database
        const db = getDatabase(app);
        const userRef = ref(db, `users/${pageData.userId}`);
        
        onValue(userRef, (snapshot) => {
          const userData = snapshot.val();
          if (userData && userData.username) {
            pageData.username = userData.username;
          } else {
            // If username not found in realtime DB, we should try to get it from Firestore
            // This is a fallback mechanism
            import('../firebase/auth').then(({ getUserProfile }) => {
              if (getUserProfile && pageData.userId) {
                getUserProfile(pageData.userId).then(profile => {
                  if (profile && profile.username) {
                    pageData.username = profile.username;
                  } else if (profile && profile.displayName) {
                    pageData.username = profile.displayName;
                  }
                  
                  // Set state with the fetched data including username
                  setPage({...pageData});
                }).catch(err => {
                  console.error("Error fetching user profile:", err);
                });
              }
            });
          }
          
          // Set state with the fetched data
          setPage(pageData);
          setEditorState(versionData.content);
          setTitle(pageData.title);

          // Check and set groupId if it exists
          if (pageData.groupId) {
            setGroupId(pageData.groupId);
          }

          // Check if the current user is the owner or if the page is public
          if (user && user.uid === pageData.userId) {
            setIsPublic(true);
          } else {
            setIsPublic(pageData.isPublic);
          }
        });

        // Data has loaded
        setIsLoading(false);
      } else {
        // Handle case where the page doesn't exist or was deleted
        setPage(null);
        setIsLoading(false);
      }
    }, user?.uid); // Pass the user ID for access control

    return () => unsubscribe();
  }, [params.id, user]);

  const Layout = user ? DashboardLayout : PublicLayout;

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

  if (isDeleted) {
    return (
      <Layout>
        <Head>
          <title>Deleted Page - WeWrite</title>
        </Head>
        <PageHeader />
        <div>
          <h1 className="text-2xl font-semibold text-text">Page not found</h1>
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
              This page has been deleted
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
        username={page?.username || "[NULL]"} 
        userId={page?.userId}
        isLoading={isLoading}
        scrollDirection={scrollDirection}
      />
      <div className="pb-24 px-2 sm:px-4 md:px-6">
        {isEditing ? (
          <LoggingProvider>
            <PageProvider>
              <LineSettingsProvider>
                <EditPage
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  page={page}
                  title={title}
                  setTitle={setTitle}
                  current={editorState}
                />
              </LineSettingsProvider>
            </PageProvider>
          </LoggingProvider>
        ) : (
          <>
            <div className="space-y-2 w-full transition-all duration-200 ease-in-out">
              <div className={`page-content ${lineViewMode === 'dense' ? 'max-w-full break-words' : ''}`}>
                <PageProvider>
                  <LineSettingsProvider>
                    <TextView 
                      content={editorState} 
                      viewMode={lineViewMode}
                    />
                  </LineSettingsProvider>
                </PageProvider>
              </div>
            </div>
            {user && user.uid === page.userId && (
              <div className="mt-8 pt-4 border-t border-border">
                <ActionRow
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  page={page}
                />
              </div>
            )}
            {user && user.uid !== page.userId && (
              <div className="mt-8 pt-4 border-t border-border">
                <PageInteractionButtons page={page} username={page?.username || ""} />
              </div>
            )}
          </>
        )}
      </div>
      {!isEditing && (
        <div className={`fixed left-0 right-0 w-full flex justify-center transition-transform duration-300 ease-in-out z-50 ${scrollDirection === "down" ? "translate-y-[200%]" : "translate-y-0"}`} style={{ bottom: '1rem' }}>
          <div className="w-[95%] max-w-md mx-auto">
            <PledgeBar />
          </div>
        </div>
      )}
    </Layout>
  );
}

export function PageInteractionButtons({ page, username }) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [showAddToPageDialog, setShowAddToPageDialog] = useState(false);
  
  const handleReplyToPage = () => {
    if (!page || !page.id) {
      console.error("Cannot reply to page: page data is missing");
      return;
    }

    // Create a new page with title "Re: "[original page title]""
    const newPageTitle = `Re: "${page.title || "Untitled"}"`;
    
    // Get content from the page if available
    let pageContentSummary = "";
    if (page.content) {
      try {
        const parsedContent = typeof page.content === 'string' 
          ? JSON.parse(page.content) 
          : page.content;

        // Extract first paragraph or so for a summary
        if (Array.isArray(parsedContent) && parsedContent.length > 0) {
          const firstPara = parsedContent.find(node => 
            node.type === 'paragraph' && 
            node.children && 
            node.children.some(child => child.text && child.text.trim().length > 0)
          );
          
          if (firstPara) {
            pageContentSummary = firstPara.children
              .map(child => child.text || '')
              .join('')
              .slice(0, 100);
              
            if (pageContentSummary.length === 100) {
              pageContentSummary += '...';
            }
          }
        }
      } catch (error) {
        console.error("Error parsing page content:", error);
      }
    }
    
    // Create the initial content with a single paragraph
    const initialContent = [
      {
        type: "paragraph",
        children: [
          { text: `Reply to ` },
          {
            type: "link",
            href: `/pages/${page.id}`,
            children: [{ text: page.title || "Untitled" }]
          },
          { text: ` by ` },
          {
            type: "link",
            href: `/profile/${page.userId || "anonymous"}`,
            children: [{ text: page.username || page.author || "Anonymous" }]
          }
        ]
      }
    ];
    
    // Add blockquote if we have content summary
    if (pageContentSummary) {
      initialContent.push({
        type: "blockquote",
        children: [{ text: pageContentSummary }]
      });
      
      // Add an empty paragraph after the blockquote
      initialContent.push({
        type: "paragraph",
        children: [{ text: "" }]
      });
    }

    // Navigate to the new page route with query parameters
    try {
      const encodedContent = encodeURIComponent(JSON.stringify(initialContent));
      const encodedTitle = encodeURIComponent(newPageTitle);
      
      console.log("Navigating to new page with title:", newPageTitle);
      router.push(`/new?title=${encodedTitle}&initialContent=${encodedContent}&isReply=true`);
    } catch (error) {
      console.error("Error navigating to new page:", error);
      // Fallback with minimal parameters if encoding fails
      router.push(`/new?title=${encodeURIComponent(newPageTitle)}&isReply=true`);
    }
  };
  
  return (
    <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 px-4 sm:px-0">
      <Button
        variant="outline"
        onClick={handleReplyToPage}
        className="w-full sm:w-[140px] h-10 flex items-center gap-2 justify-center"
      >
        <Reply className="h-4 w-4" />
        Reply to page
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowAddToPageDialog(true)}
        className="w-full sm:w-[140px] h-10 flex items-center gap-2 justify-center"
      >
        <Plus className="h-4 w-4" />
        Add to page
      </Button>
      
      <AddToPageDialog 
        open={showAddToPageDialog} 
        onOpenChange={setShowAddToPageDialog}
        pageToAdd={page}
      />
    </div>
  );
}

function AddToPageDialog({ open, onOpenChange, pageToAdd }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);
  const searchInputRef = useRef(null);
  const { toast } = useToast();
  
  // Focus search input when dialog opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [open]);
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
    }
  }, [open]);
  
  // Search for pages that the user can edit
  const handleSearch = async (query) => {
    if (!user) {
      setError("You must be logged in to search for pages");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Clear results if query is empty
      if (!query || query.length < 2) {
        setSearchResults([]);
        return;
      }
      
      const pages = await getEditablePagesByUser(user.uid, query);
      
      // Filter out the current page from results
      const filteredPages = pages.filter(page => page.id !== pageToAdd?.id);
      setSearchResults(filteredPages || []);
      
      if (filteredPages.length === 0 && query.length >= 2) {
        console.log("No pages found matching query:", query);
      }
    } catch (error) {
      console.error("Error searching for pages:", error);
      setError("Failed to search for pages. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, user]);
  
  // Handle adding the page to another page
  const handleAddToPage = async (targetPage) => {
    try {
      setIsLoading(true);
      
      // Create a new version of the target page with the added content
      await appendPageReference(targetPage.id, pageToAdd);
      
      // Close the dialog
      onOpenChange(false);
      
      // Show success message
      toast({
        title: "Success!",
        description: `"${pageToAdd.title}" added to "${targetPage.title}"`,
        status: "success",
      });
    } catch (error) {
      console.error("Error adding page reference:", error);
      setError("Failed to add page. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add to page
          </DialogTitle>
          <DialogDescription>
            Select a page to append "{pageToAdd?.title}" to the end of
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 py-4">
          <div className="grid flex-1 gap-2">
            <label htmlFor="page-search" className="sr-only">Search</label>
            <input
              id="page-search"
              placeholder="Search your pages..."
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              ref={searchInputRef}
            />
            
            <div className="max-h-60 overflow-y-auto border rounded-md p-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <Loader className="h-4 w-4 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Searching...</p>
                </div>
              ) : error ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery.length > 1 ? "No pages found" : "Type to search"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {searchResults.map((page) => (
                    <li
                      key={page.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => handleAddToPage(page)}
                    >
                      <span className="truncate">{page.title}</span>
                      <Button variant="ghost" size="sm">
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
