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
import { checkLinkExistence } from "../utils/check-link-existence";

export default function SinglePageView  ({ pageData, versionData, links }) {
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
    if (!page) {
      const fetchPage = async () => {
        setPage(pageData);
        setEditorState(versionData.content);
        setTitle(pageData.title);
        
        if (pageData.groupId) {
          setGroupId(pageData.groupId);
        }

        if (user && user.uid === pageData.userId) {
          setIsPublic(true);
        } else {
          setIsPublic(pageData.isPublic);
        }

        // check if the page exists
        if (links.length > 0) {
          checkLinkExistence(links).then((results) => {
            // Process results
            for (let url in results) {
              const exists = results[url];
              if (!exists) {
                // Gray out the corresponding button or link in the UI
                const linkElement = document.querySelector(`a[href="${url}"]`);
                if (linkElement) {
                  linkElement.classList.remove("bg-blue-500"); // Remove the blue background color
                  linkElement.classList.add("bg-gray-500"); // Add the gray background color
                  linkElement.disabled = true; // Optionally disable the link
                  // add cursor not-allowed
                  linkElement.style.cursor = "not-allowed";
                }
              }
            }
          });
        }

        setIsLoading(false);
      };

      fetchPage();
    }
  }, [pageData, versionData, links]);


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
            <span className="text-lg text-text">This page has been deleted</span>
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
          <h1 className="text-2xl font-semibold text-text">Sorry this page is private</h1>
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
            <h1 className="text-3xl mt-4 md:text-4xl font-semibold text-text fade-in">{title}</h1>
            {
              groupId && (
                <div className="flex items-center gap-2 mt-4 fade-in" style={{ animationDelay: "100ms" }}>
                  <div className="flex flex-col text-text">
                    <span>Belongs to</span>
                  <GroupBadge groupId={groupId} />
                  </div>
                </div>
              )
            }
            <div className="flex space-x-1 my-4 fade-in" style={{ animationDelay: "200ms" }}>
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
            {/* <DonateBar />             */}
          </>
        )}
      </div>
      {/* {
        user && user.uid === page.userId && (
          <VersionsList pageId={params.id} currentVersion={page.currentVersion} />
        )
      } */}
    </DashboardLayout>
  );
}