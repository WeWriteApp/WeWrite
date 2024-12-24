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
import { listenToPageById } from "../firebase/database";
import PledgeBar from "./PledgeBar";

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
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let unsubscribe;
    try {
      unsubscribe = listenToPageById(params.id, (data) => {
        if (data) {
          const { pageData, versionData } = data;
          console.log('Received page data:', pageData);
          console.log('Received version data:', versionData);

          if (process.env.NODE_ENV === 'development' && user?.uid === 'test-user') {
            setIsPublic(true);
          } else {
            setIsPublic(pageData.isPublic || (user && user.uid === pageData.userId));
          }

          setPage(pageData);
          setEditorState(versionData?.content || '');
          setTitle(pageData.title);

          if (pageData.groupId) {
            setGroupId(pageData.groupId);
          }

          setIsLoading(false);
          setError(null);
        } else {
          setPage(null);
          setIsLoading(false);
          setError('Page not found');
        }
      });
    } catch (err) {
      console.error('Error in listenToPageById:', err);
      setError(err.message);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [params.id, user, isClient]);

  if (!isClient || isLoading) {
    return (
      <DashboardLayout>
        <Loader />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-text">Error</h1>
          <p className="text-red-500 mt-2">{error}</p>
          <Link href="/pages">
            <button className="bg-background text-button-text px-4 py-2 rounded-full mt-4">
              Go back
            </button>
          </Link>
        </div>
      </DashboardLayout>
    );
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
      <div className="fixed top-0 left-0 w-full flex justify-center bg-background z-50">
        {user && <PledgeBar pageId={params.id} user={user} />}
      </div>
      <div className="p-2 mt-28">
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
    </DashboardLayout>
  );
}
