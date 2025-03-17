"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import TextView from "./TextView";
import { AlertTriangle } from "lucide-react";
import { Loader } from "./Loader";
import Link from "next/link";
import { AuthContext } from "../providers/AuthProvider";
import EditPage from "./EditPage";
import ActionRow from "./PageActionRow";
import { listenToPageById } from "../firebase/database";
import PledgeBar from "./PledgeBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Lock } from "lucide-react";
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
            <AlertTriangle className="h-5 w-5 text-red-500" />
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
            <Lock className="h-5 w-5 text-muted-foreground" />
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
      <div className="p-2 pb-24">
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
      <div className="fixed bottom-0 pb-16 pt-4 w-full flex justify-center">
        <PledgeBar />
      </div>
    </Layout>
  );
}
