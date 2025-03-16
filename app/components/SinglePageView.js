"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import TextView from "./TextView";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "./Loader";
import Link from "next/link";
import { AuthContext } from "../providers/AuthProvider";
import User from "./UserBadge";
import GroupBadge from "./GroupBadge";
import EditPage from "./EditPage";
import ActionRow from "./PageActionRow";
// import { checkLinkExistence } from "../utils/check-link-existence";
import { listenToPageById } from "../firebase/database";
import PledgeBar from "./PledgeBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Lock } from "lucide-react";
import Head from "next/head";
import PageHeader from "./PageHeader";

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
    const unsubscribe = listenToPageById(params.id, (data) => {
      if (data) {
        const { pageData, versionData, links } = data;

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

        // Check if links exist
        // if (links.length > 0) {
        //   checkLinkExistence(links).then((results) => {
        //     // Process link existence results
        //     for (let url in results) {
        //       const exists = results[url];
        //       if (!exists) {
        //         // Update UI for invalid links (e.g., gray out and disable)
        //         const linkElement = document.querySelector(`a[href="${url}"]`);
        //         if (linkElement) {
        //           linkElement.classList.remove("bg-blue-500");
        //           linkElement.classList.add("bg-gray-500");
        //           linkElement.disabled = true;
        //           linkElement.style.cursor = "not-allowed"; // Disable click
        //         }
        //       }
        //     }
        //   });
        // }

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

  if (!page) {
    return (
      <>
        <Head>
          <title>Page Not Found - WeWrite</title>
        </Head>
        <PageHeader />
        <Loader />
      </>
    );
  }
  if (isDeleted) {
    return (
      <>
        <Head>
          <title>Deleted Page - WeWrite</title>
        </Head>
        <DashboardLayout>
          <PageHeader />
          <div>
            <h1 className="text-2xl font-semibold text-text">Page not found</h1>
            <div className="flex items-center gap-2 mt-4">
              <Icon icon="akar-icons:warning" className="text-red-500" />
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
        </DashboardLayout>
      </>
    );
  }
  if (isLoading) {
    return (
      <>
        <Head>
          <title>Loading... - WeWrite</title>
        </Head>
        <PageHeader />
        <Loader />
      </>
    );
  }
  if (!isPublic && (!user || user.uid !== page.userId)) {
    return (
      <>
        <Head>
          <title>Private Page - WeWrite</title>
        </Head>
        <DashboardLayout>
          <PageHeader />
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-text">
              {title}
            </h1>
            <div className="flex items-center gap-2 mt-4">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg text-muted-foreground">This page is private</span>
              <Link href="/">
                <button className="bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
                  Go back
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{title} - WeWrite</title>
      </Head>
      <DashboardLayout>
        <PageHeader />
        <div className="p-2">
          {isEditing ? (
            <EditPage
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              page={page}
              title={title}
              setTitle={setTitle}
              current={editorState}
            />
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
      </DashboardLayout>
    </>
  );
}
