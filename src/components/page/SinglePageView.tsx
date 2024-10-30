"use client";
import React, { useEffect, useState, useContext } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";
import { AuthContext } from "@/providers/AuthProvider";
import { listenToPageById } from "@/firebase/database";
import Layout from "../layout/Layout";
import { Spinner } from "@nextui-org/react";
import PledgeBar from "../PledgeBar";
import ActionRow from "../ActionRow";
import TextView from "../TextView";
import EditPage from "../EditPage";
import User from "../badge/User";
import { useParams, useSearchParams } from "next/navigation";

interface IPageData {
  isPublic: boolean;
  userId: string;
  createdAt: string;
  lastModified: string;
}

export default function SinglePageView() {

  const param = useParams()
  const [page, setPage] = useState<IPageData | null>(null);
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
    const unsubscribe = listenToPageById(param?.id as string, (data: any) => {
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
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [param, user]);

  if (!page) {
    return <div className={`fixed top-0 bottom-0 left-0 right-0 z-max`}>
      <Spinner size="lg" color="primary" className="top-1/2 left-1/2 scale-150" />
    </div>;
  }
  if (isDeleted) {
    return (
      <Layout>
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
      </Layout>
    );
  }
  if (isLoading) {
    return <div className={`fixed top-0 bottom-0 left-0 right-0 z-max`}>
      <Spinner size="lg" color="primary" className="top-1/2 left-1/2 scale-150" />
    </div>;
  }
  if (!isPublic) {
    return (
      <Layout>
        <div>
          <h1 className="text-2xl font-semibold text-text">
            Sorry this page is private
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg text-text">This page is private</span>
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
  return (
    <Layout>
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
                  {/* <GroupBadge groupId={groupId} /> */}
                </div>
              </div>
            )}
            <div
              className="flex space-x-1 my-4 fade-in"
              style={{ animationDelay: "200ms" }}
            >
              <span className="text-text">Written by {"  "}</span>
              <User uid={page.userId} />
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
      <div className={`fixed bottom-0 pb-16 pt-4 w-full flex justify-center ${page.userId === user?.uid ? "hidden" : ""}`}>
        <PledgeBar />
      </div>
    </Layout>
  );
}
