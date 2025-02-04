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

  useEffect(() => {
    const unsubscribe = listenToPageById(params.id, (data) => {
      if (data) {
        const { pageData, versionData, links } = data;
        setPage(pageData);
        setEditorState(versionData.content);
        setTitle(pageData.title);
        if (pageData.groupId) {
          setGroupId(pageData.groupId);
        }
        setIsPublic(user && user.uid === pageData.userId ? true : pageData.isPublic);
        setIsLoading(false);
      } else {
        setPage(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [params.id, user]);

  if (!page) return <Loader />;
  if (isDeleted) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold text-text">Page not found</h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg text-text">This page has been deleted</span>
            <Link href="/pages">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">Go back</button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  if (isLoading) return <Loader />;
  if (!isPublic) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold text-text">Sorry, this page is private</h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg text-text">This page is private</span>
            <Link href="/pages">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">Go back</button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative p-2 text-text text-center">
        {/* ActionRow in the top-right corner */}
        {user && user.uid === page.userId && (
          <div className="absolute top-4 right-4">
            <ActionRow isEditing={isEditing} setIsEditing={setIsEditing} page={page} />
          </div>
        )}

        {isEditing ? (
          <EditPage isEditing={isEditing} setIsEditing={setIsEditing} page={page} title={title} setTitle={setTitle} current={editorState} />
        ) : (
          <>
            <div className="flex flex-col items-center">
              <h1 className="text-3xl mt-4 md:text-4xl font-semibold text-text fade-in">{title}</h1>
              {groupId && (
                <div className="flex items-center gap-2 mt-4 fade-in" style={{ animationDelay: "100ms" }}>
                  <div className="flex flex-col text-text">
                    <span>Belongs to</span>
                    <GroupBadge groupId={groupId} />
                  </div>
                </div>
              )}
              <div className="flex space-x-1 my-2 fade-in text-text text-sm text-center" style={{ animationDelay: "200ms" }}>
                <span className="text-text">Written by {"  "}</span>
                <User uid={page.userId} />
              </div>
            </div>
            <div className="w-full text-start mt-4 border-t border-gray-200">
              <TextView content={editorState} />
            </div>
          </>
        )}

        <div className="fixed bottom-0 pb-16 pt-4 w-full flex justify-center">
          <PledgeBar />
        </div>
      </div>
    </DashboardLayout>
  );
}