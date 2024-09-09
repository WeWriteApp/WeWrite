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
  updateDoc,
} from "../../firebase/database";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import VersionsList from "../../components/VersionsList";
import { AuthContext } from "../../providers/AuthProvider";
import Profile from "../../components/ProfileBadge";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import GroupBadge from "../../components/GroupBadge";
import { GroupsContext } from "../../providers/GroupsProvider";

const Page = ({ params }) => {
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
    if (!params.id) return;
    if (!page) {
      const fetchPage = async () => {
        const { pageData, versionData, links } = await getPageById(params.id);
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
  }, [params]);

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
      <div className="mb-40">
        {user && user.uid === page.userId && (
          <ActionRow
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            page={page}
          />
        )}

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
            <h1 className="text-2xl md:text-4xl font-semibold text-text">{title}</h1>
            {
              groupId && (
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex flex-col text-text">
                    <span>Belongs to</span>
                  <GroupBadge groupId={groupId} />
                  </div>
                </div>
              )
            }
            <div className="flex space-x-1 my-4">
              <span className="text-text">Written by {"  "}</span>
              <Profile uid={page.userId} />
            </div>
            <TextView content={editorState} />

            <DonateBar />            
          </>
        )}
      </div>
      {
        user && user.uid === page.userId && (
          <VersionsList pageId={params.id} currentVersion={page.currentVersion} />
        )
      }
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
    <div className="flex items-center gap-2">
      <button
        className="bg-background text-button-text  px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </button>
      <button
        onClick={handleDelete}
        className="bg-background border-gray-500 border text-button-text px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Delete
      </button>
    </div>
  );
};

const EditPage = ({
  isEditing,
  setIsEditing,
  page,
  current,
  title,
  setTitle,
}) => {
  const [editorState, setEditorState] = useState(JSON.parse(current));
  const [groupId, setGroupId] = useState(null);
  const [localGroups, setLocalGroups] = useState([]);
  const { user } = useContext(AuthContext);
  const groups = useContext(GroupsContext);
  useEffect(() => {
    if (page.groupId) {
      setGroupId(page.groupId);
    }
  }, []);

  useEffect(() => {
    console.log("Groups", groups);
    if (!groups) return;
    if (groups.length > 0) {
      if (user.groups) {
        let arr = [];
        Object.keys(user.groups).forEach((groupId) => {
          const group = groups.find((g) => g.id === groupId);
          if (group) {
            arr.push({
              id: groupId,
              name: group.name,
            });
          }
        })
        setLocalGroups(arr);
      }
    }
  }, [groups]);

  const handleSelect = (item) => {
    console.log("Selected item", item);
    setGroupId(item.id);
  }

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
    })
      .then((result) => {
        if (result) {
          // update the page content
          updateDoc("pages", page.id, {
            title: title,
            isPublic: page.isPublic,
            groupId: groupId,
          });

          setIsEditing(false);
          alert("Page updated successfully");
        } else {
          console.log("Error saving new version");
        }
      })
      .catch((error) => {
        console.log("Error saving new version", error);
      });
  };

  const removeGroup = () => {
    setGroupId(null);
  }

  const handleCancel = () => {
    // reset the editorState
    setEditorState(page.content);
    setIsEditing(false);
  };

  return (
    <div>
      <label className="text-lg font-semibold text-text">Title</label>
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

      <label className="text-lg font-semibold">Group</label>
      <p className="text-sm text-gray-500">
        Currently this page is in the group: {groupId}
      </p>
      <ReactSearchAutocomplete
        items={localGroups}
        onSelect={handleSelect}
        autoFocus
        placeholder="Search for a group"
        fuseOptions={{
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return <div key={item.id}>{item.name}</div>;
        }}
      />

      {
        page.groupId && (
          <div className="flex items-center gap-2 mt-4">
            <button
              className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
              onClick={removeGroup}
            >
              Remove group
            </button>
          </div>
        )
      }

      <div className="flex items-center gap-2 mt-4">
        <button
          className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
          onClick={() => handleSave()}
        >
          Save
        </button>
        <button
          className="bg-background text-button-text px-4 py-2"
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
