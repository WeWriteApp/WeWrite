"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import TextView from "./TextView";
import { useRouter } from "next/navigation";
import { getDatabase, ref, onValue, set, update, remove } from "firebase/database";
import { app } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { useToast } from "../components/ui/use-toast";
import { RecentPagesContext } from "../contexts/RecentPagesContext";
import { 
  Loader, 
  Share, 
  Copy, 
  Lock, 
  Unlock, 
  Edit, 
  Check, 
  X, 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Link2, 
  Reply 
} from "lucide-react";
import Link from "next/link";
import { listenToPageById } from "../firebase/database";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import Head from "next/head";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import SiteFooter from "./SiteFooter";
import { LoggingProvider } from "../providers/LoggingProvider";
import { PageProvider } from "../contexts/PageContext";
import { LineSettingsProvider } from '../contexts/LineSettingsContext';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogClose 
} from './ui/dialog';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from './ui/command';
import EditPage from "./EditPage";
import ActionRow from "./PageActionRow";

export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [groupName, setGroupName] = useState(null);
  const [lineViewMode, setLineViewMode] = useState('normal');
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState(null);
  const [pageFullyRendered, setPageFullyRendered] = useState(false);
  const [title, setTitle] = useState(null);
  const { user } = useContext(AuthContext);
  const { recentPages = [], addRecentPage } = useContext(RecentPagesContext) || {};
  const { toast } = useToast();

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
            
            // Get group data to fetch the group name
            const groupRef = ref(db, `groups/${pageData.groupId}`);
            onValue(groupRef, (groupSnapshot) => {
              const groupData = groupSnapshot.val();
              if (groupData && groupData.name) {
                setGroupName(groupData.name);
              }
            });
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

  const handleViewModeChange = (value) => {
    setLineViewMode(value);
    localStorage.setItem('pageViewMode', value);
  };

  // Function to handle when page content is fully rendered
  const handlePageFullyRendered = () => {
    setPageFullyRendered(true);
  };

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
        groupId={groupId}
        groupName={groupName}
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
                      onRenderComplete={handlePageFullyRendered}
                    />
                  </LineSettingsProvider>
                </PageProvider>
              </div>
            </div>
            
            {/* Page Controls - Only show after content is fully rendered */}
            {pageFullyRendered && (
              <div className="mt-8 flex flex-col gap-4">
                {user && user.uid === page.userId && (
                  <div className="mt-8">
                    <ActionRow
                      isEditing={isEditing}
                      setIsEditing={setIsEditing}
                      page={page}
                    />
                  </div>
                )}
                {user && user.uid !== page.userId && (
                  <div className="mt-8">
                    <PageInteractionButtons page={page} username={page?.username || ""} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <PageFooter 
        page={page}
        isOwner={user?.uid === page?.userId}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
      />
      <SiteFooter />
    </Layout>
  );
}

export function PageInteractionButtons({ page, username }) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [showAddToPageDialog, setShowAddToPageDialog] = useState(false);
  const { toast } = useToast();
  const [lineViewMode, setLineViewMode] = useState("normal");
  
  const handleViewModeChange = (value) => {
    setLineViewMode(value);
    localStorage.setItem("lineViewMode", value);
    // Trigger re-render of the page content
    window.dispatchEvent(new Event("viewModeChanged"));
  };
  
  const handleCopyLink = () => {
    const pageUrl = `${window.location.origin}/pages/${page.id}`;
    navigator.clipboard.writeText(pageUrl).then(() => {
      toast({
        title: "Link copied",
        description: "Page link has been copied to clipboard",
      });
    }).catch(err => {
      console.error('Failed to copy link:', err);
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive"
      });
    });
  };
  
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
    
    // Create the initial content with a single paragraph and properly formatted links
    const initialContent = [
      {
        type: "paragraph",
        children: [
          { text: `Reply to ` },
          {
            type: "link",
            url: `/pages/${page.id}`,
            children: [{ text: page.title || "Untitled" }]
          },
          { text: ` by ` },
          {
            type: "link",
            url: `/profile/${page.userId || "anonymous"}`,
            children: [{ text: page.username || page.author || "Anonymous" }]
          },
          { text: "" }
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
    } else {
      // If no content summary, add an empty line
      initialContent.push({
        type: "paragraph",
        children: [{ text: "" }]
      });
    }

    // Add another empty paragraph for user to start typing
    initialContent.push({
      type: "paragraph",
      children: [{ text: "" }]
    });

    // Navigate to the new page route with query parameters
    try {
      const encodedContent = encodeURIComponent(JSON.stringify(initialContent));
      const encodedTitle = encodeURIComponent(newPageTitle);
      
      console.log("Navigating to new page with pre-filled content:", initialContent);
      router.push(`/new?title=${encodedTitle}&initialContent=${encodedContent}&isReply=true`);
    } catch (error) {
      console.error("Error navigating to new page:", error);
      // Fallback with minimal parameters if encoding fails
      router.push(`/new?title=${encodeURIComponent(newPageTitle)}&isReply=true`);
    }
  };
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2 px-4 sm:px-0">
        {/* Copy Link Button */}
        <Button
          variant="outline"
          onClick={handleCopyLink}
          className="w-full sm:w-auto h-10 flex items-center gap-2 justify-center"
        >
          <Link2 className="h-4 w-4" />
          Copy link
        </Button>
        
        {/* Reply to Page Button */}
        <Button
          variant="outline"
          onClick={handleReplyToPage}
          className="w-full sm:w-auto h-10 flex items-center gap-2 justify-center"
        >
          <Reply className="h-4 w-4" />
          Reply to page
        </Button>
        
        {/* Add to Page Button */}
        <Button
          variant="outline"
          onClick={() => setShowAddToPageDialog(true)}
          className="w-full sm:w-auto h-10 flex items-center gap-2 justify-center"
        >
          <Plus className="h-4 w-4" />
          Add to page
        </Button>
      </div>
      
      {/* Page Layout Radio Group */}
      <div className="mt-2 px-4 sm:px-0">
        <div className="mb-2">
          <Label className="text-sm font-medium">Page layout</Label>
        </div>
        <RadioGroup 
          defaultValue={lineViewMode} 
          onValueChange={handleViewModeChange}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id="normal" />
            <Label htmlFor="normal" className="text-sm">Normal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dense" id="dense" />
            <Label htmlFor="dense" className="text-sm">Dense</Label>
          </div>
        </RadioGroup>
      </div>
      
      <AddToPageDialog 
        open={showAddToPageDialog} 
        onOpenChange={setShowAddToPageDialog}
        pageToAdd={page}
      />
    </div>
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
