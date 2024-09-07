"use client";
import React, { useEffect, useState, useContext } from "react";
import { getPageById } from "../../firebase/database";
import DashboardLayout from "../../DashboardLayout";
import TextView from "../../components/TextView";
import DonateBar from "../../components/DonateBar";
import SlateEditor from "../../components/SlateEditor";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "../../components/Loader";
import Link from "next/link";
import {
  db,
  deletePage,
  saveNewVersion,
  updatePageDoc,
  updateDoc,
  setCurrentVersion,
} from "../../firebase/database";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import VersionsList from "../../components/VersionsList";
import { AuthContext } from "../../providers/AuthProvider";

const Page = ({ params }) => {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(false);
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!params.id) return;
    if (!page) {
      const fetchPage = async () => {
        const { pageData, versionData, links } = await getPageById(params.id);
        setPage(pageData);
        setEditorState(versionData.content);
        setTitle(pageData.title);

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
  }, [params]);

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
  if (isLoading) {
    return <Loader />;
  }
  if (!isPublic) {
    return (
      <DashboardLayout>
        <div>
          <h1 className="text-2xl font-semibold">Sorry this page is private</h1>
          <div className="flex items-center gap-2 mt-4">
            <Icon icon="akar-icons:warning" className="text-red-500" />
            <span className="text-lg">This page is private</span>
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
      <div className="mb-40">
        <ActionRow
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          page={page}
        />
        <div className="flex w-full h-1 bg-gray-200 my-4"></div>
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
            <h1 className="text-5xl font-semibold">{page.title}</h1>
            <p className="text-gray-500 text-sm">
              current version: {page.currentVersion} - created at{" "}
              {page.createdAt}
            </p>
            <TextView content={editorState} />
            <DonateBar />
          </>
        )}


      </div>
      <VersionsList pageId={params.id} currentVersion={page.currentVersion} />
    </DashboardLayout>
  );
};

const ActionRow = ({ isEditing, setIsEditing, page }) => {
  const router = useRouter();
  const handleDelete = async () => {
    let confirm = window.confirm("Are you sure you want to delete this page?");

    if (!confirm) return;
    const result = await deletePage(page.id);
    if (result) {
      router.push("/pages");
    } else {
      console.log("Error deleting page");
    }
  };

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        className="bg-white text-black  px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </button>
      <button
        onClick={handleDelete}
        className="bg-white border-gray-500 border text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Delete
      </button>
    </div>
  );
};

const EditPage = ({ isEditing, setIsEditing, page, current, title,setTitle }) => {
  const [editorState, setEditorState] = useState(JSON.parse(current));
  const { user } = useContext(AuthContext);

  const handleSave = () => {
    if (!user) {
      console.log("User not authenticated");
      return;
    }

    if (!title || title.length === 0) {
      console.log("Title is required");
      return;
    }
    // convert the editorState to JSON
    const editorStateJSON = JSON.stringify(editorState);

    // // save the new version
    saveNewVersion(page.id, {
      content: editorStateJSON,
      userId: user.uid,
    }).then((result) => {
      if (result) {
        // update the page content
        updateDoc("pages", page.id, {
          title: title,
          isPublic: page.isPublic,
        });

        setIsEditing(false);
        alert("Page updated successfully");
      } else {
        console.log("Error saving new version");
      }
    }).catch((error) => {
      console.log("Error saving new version", error);
    });
  };

  const handleCancel = () => {
    // reset the editorState
    setEditorState(page.content);
    setIsEditing(false);
  };

  return (
    <div>
      <label className="text-lg font-semibold">Title</label>
      <input
        type="text"
        defaultValue={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border border-gray-200 p-2 text-3xl w-full"
      />

      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <SlateEditor
        setEditorState={setEditorState}
        initialEditorState={JSON.parse(current)}
      />
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <div className="flex items-center gap-2 mt-4">
        <button
          className="bg-white text-black px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
          onClick={() => handleSave()}
        >
          Save
        </button>
        <button
          className="bg-white text-black px-4 py-2"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Page;

async function checkLinkExistence(links) {
  const promises = [];
  const results = {};

  for (let url of links) {
    const docRef = doc(db, url);
    promises.push(
      getDoc(docRef).then((doc) => {
        results[url] = doc.exists();
      })
    );
  }

  // Wait for all document checks to complete
  await Promise.all(promises);

  return results;
}
