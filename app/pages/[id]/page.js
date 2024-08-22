"use client";
import React, { useEffect, useState } from "react";
import { getDocById } from "../../firebase/database";
import DashboardLayout from "../../DashboardLayout";
import TextView from "../../components/TextView";
import DonateBar from "../../components/DonateBar";
import { updateDoc } from "../../firebase/database";
import SlateEditor from "../../components/SlateEditor";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "../../components/Loader";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Page = ({ params }) => {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!params.id) return;
    const fetchPage = async () => {
      const page = await getDocById("pages", params.id);
      let obj = {
        id: page.id,
        ...page.data(),
      };

      if (obj) {
        if (!obj.content) {
          setIsDeleted(true);
          return;
        } else {
          setPage(obj);
          setEditorState(page.data().content);
        }
      }
     
    };

    fetchPage();
  }, [params]);

  useEffect(() => {
    if (isDeleted) {
      router.push("/pages");
    }
  }, [isDeleted]);

  if (!page) {
    return <Loader />;
  }
  if (isDeleted) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg">This page has been deleted</span>
            <Link href="/pages">
              <button className="bg-blue-500 text-white px-4 py-2 rounded-full">
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
      <div>
        <ActionRow isEditing={isEditing} setIsEditing={setIsEditing} />
        <div className="flex w-full h-1 bg-gray-200 my-4"></div>
        {isEditing ? (
          <EditPage
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            page={page}
          />
        ) : (
          <>
            <h1 className="text-5xl font-semibold">{page.title}</h1>
            <TextView content={editorState} />
            <DonateBar />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const ActionRow = ({ isEditing, setIsEditing }) => {
  return (
    <div className="flex items-center gap-4 mt-4">
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded-full"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </button>
      <button className="bg-red-500 text-white px-4 py-2 rounded-full">
        Delete
      </button>
    </div>
  );
};

const EditPage = ({ isEditing, setIsEditing, page }) => {
  const [editorState, setEditorState] = useState(null);

  const [title, setTitle] = useState(page.title);
  const handleSave = () => {
    // convert the editorState to JSON
    const editorStateJSON = JSON.stringify(editorState);

    // update the page content
    updateDoc("pages", page.id, { content: editorStateJSON, title });

    console.log("Page updated");
    setIsEditing(false);
  };

  const handleCancel = () => {
    // reset the editorState
    setEditorState(page.content);
    setIsEditing(false);
  };
  return (
    <div className="container mx-auto">
      <label className="text-lg font-semibold">Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border border-gray-200 p-2 text-3xl w-full"
      />

      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <SlateEditor
        setEditorState={setEditorState}
        initialEditorState={JSON.parse(page.content)}
      />
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded-full"
        onClick={() => handleSave()}
      >
        Save
      </button>
      <button
        className="bg-red-500 text-white px-4 py-2 rounded-full"
        onClick={handleCancel}
      >
        Cancel
      </button>
    </div>
  );
};

const Author = ({ author }) => {
  return (
    <div className="flex items-center gap-2 mt-4">
      <div className="flex items-center gap-2 border border-gray-200 py-2 px-4 rounded-full hover:bg-gray-100 cursor-pointer">
        <img
          src={author.photoURL}
          className="w-8 h-8 rounded-full"
          alt={author.displayName}
        />
        <span className="text-sm font-semibold">{author.displayName}</span>
      </div>
    </div>
  );
};

export default Page;
