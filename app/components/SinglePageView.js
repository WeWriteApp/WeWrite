"use client";
import React, { useEffect, useState, useContext } from "react";
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

export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [lineViewMode, setLineViewMode] = useState('default');
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const storedMode = localStorage.getItem('pageViewMode');
    if (storedMode && ['wrapped', 'default', 'spaced'].includes(storedMode)) {
      setLineViewMode(storedMode);
    }

    const handleStorageChange = (e) => {
      if (e.key === 'pageViewMode' && ['wrapped', 'default', 'spaced'].includes(e.newValue)) {
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
      if (currentMode && currentMode !== lineViewMode && ['wrapped', 'default', 'spaced'].includes(currentMode)) {
        setLineViewMode(currentMode);
      }
    }, 1000); // Check every second

    return () => clearInterval(intervalId);
  }, [lineViewMode]);

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
      if (data) {
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
    });

    return () => unsubscribe();
  }, [params.id, user]);

  // Add scroll event listener to detect scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (currentScrollTop > lastScrollTop) {
        // Scrolling down
        setScrollDirection("down");
      } else {
        // Scrolling up
        setScrollDirection("up");
      }
      
      setLastScrollTop(currentScrollTop);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollTop]);

  const Layout = user ? DashboardLayout : PublicLayout;

  if (!page) {
    return (
      <Layout>
        <Head>
          <title>Page Not Found - WeWrite</title>
        </Head>
        <PageHeader />
        <Loader />
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
      <div className="pb-36">
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
            <div className="space-y-4 p-4">
              <div className={`page-content ${lineViewMode === 'wrapped' ? 'text-sm' : ''}`}>
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
        <div className={`fixed left-0 right-0 w-full flex justify-center transition-transform duration-300 ease-in-out ${scrollDirection === "down" ? "translate-y-[200%]" : "translate-y-0"}`} style={{ bottom: '1rem' }}>
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
  const [showAddToPageDialog, setShowAddToPageDialog] = useState(false);
  
  const handleReplyToPage = () => {
    // Create a new page with title "Re: [original page title]"
    const newPageTitle = `Re: ${page.title}`;
    
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
          { text: `This is a reply to ` },
          {
            type: "link",
            url: `/pages/${page.id}`,
            displayText: page.title,
            children: [{ text: page.title }]
          },
          { text: ` by ` },
          {
            type: "link",
            url: `/profile/${page.userId}`,
            displayText: page.username || "Anonymous",
            children: [{ text: page.username || "Anonymous" }]
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
    }

    // Navigate to the new page route with query parameters
    router.push(`/pages/new?title=${encodeURIComponent(newPageTitle)}&initialContent=${encodeURIComponent(JSON.stringify(initialContent))}`);
  };
  
  return (
    <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 px-4 sm:px-0">
      <Button
        variant="outline"
        onClick={handleReplyToPage}
        className="w-full sm:w-auto flex items-center gap-2 justify-center"
      >
        <Reply className="h-4 w-4" />
        Reply to page
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowAddToPageDialog(true)}
        className="w-full sm:w-auto flex items-center gap-2 justify-center"
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
  const { user } = useContext(AuthContext);
  
  // Search for pages that the user can edit
  const handleSearch = async (query) => {
    if (!query || query.length < 2 || !user) return;
    
    setIsLoading(true);
    try {
      // You'd need to implement this function in your firebase/database.js file
      const pages = await getEditablePagesByUser(user.uid, query);
      setSearchResults(pages || []);
    } catch (error) {
      console.error("Error searching for pages:", error);
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
  }, [searchQuery]);
  
  // Handle adding the page to another page
  const handleAddToPage = async (targetPage) => {
    try {
      // Create a new version of the target page with the added content
      // You'd need to implement this function in your firebase/database.js file
      await appendPageReference(targetPage.id, pageToAdd);
      
      // Close the dialog
      onOpenChange(false);
      
      // Show success message
      alert(`${pageToAdd.title} added to ${targetPage.title}`);
    } catch (error) {
      console.error("Error adding page reference:", error);
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
            />
            
            <div className="max-h-60 overflow-y-auto border rounded-md p-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <Loader className="h-4 w-4 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Searching...</p>
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
