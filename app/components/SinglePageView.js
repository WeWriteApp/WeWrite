"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import TextView from "./TextView";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "./Loader";
import Link from "next/link";
import { AuthContext } from "../providers/AuthProvider";
import Profile from "./ProfileBadge";
import GroupBadge from "./GroupBadge";
import EditPage from "./EditPage";
import ActionRow from "./PageActionRow";
// import { checkLinkExistence } from "../utils/check-link-existence";
import { listenToPageById } from "../firebase/database";

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

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, [params.id, user]);

  if (!page) {
    return <Loader />;
  }
  if (isDeleted) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold text-text">Page not found</h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg text-text">
              This page has been deleted
            </span>
            <Link href="/pages">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">
                Go back
              </button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  if (isLoading) {
    return <Loader />;
  }
  if (!isPublic) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold text-text">
            Sorry this page is private
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg text-text">This page is private</span>
            <Link href="/pages">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">
                Go back
              </button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <div className="">
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
            <h1 className="text-3xl mt-4 md:text-4xl font-semibold text-text fade-in">
              {title}
            </h1>
            {groupId && (
              <div
                className="flex items-center gap-2 mt-4 fade-in"
                style={{ animationDelay: "100ms" }}
              >
                <div className="flex flex-col text-text">
                  <span>Belongs to</span>
                  <GroupBadge groupId={groupId} />
                </div>
              </div>
            )}
            <div
              className="flex space-x-1 my-4 fade-in"
              style={{ animationDelay: "200ms" }}
            >
              <span className="text-text">Written by {"  "}</span>
              <Profile uid={page.userId} />
            </div>

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
    </DashboardLayout>
  );
}
