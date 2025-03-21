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

export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState("");
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScrollTop, setLastScrollTop] = useState(0);

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
        title={title} 
        username={page?.username || "[NULL]"} 
        userId={page?.userId}
        isLoading={isLoading}
      />
      <div className="p-2 pb-36">
        {isEditing ? (
          <LoggingProvider>
            <EditPage
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              page={page}
              title={title}
              setTitle={setTitle}
              current={editorState}
            />
          </LoggingProvider>
        ) : (
          <>
            <TextView content={editorState} />
            {user && user.uid === page.userId && (
              <ActionRow
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                page={page}
              />
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
