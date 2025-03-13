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
import PageMetadata from "./PageMetadata";
import { ref, get, update } from "firebase/database";
import { rtdb, db } from "../firebase/firebase";
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';

export default function SinglePageView({ params }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [authorUsername, setAuthorUsername] = useState(null);
  const [groupName, setGroupName] = useState(null);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState("");
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [userGroups, setUserGroups] = useState([]);

  useEffect(() => {
    // Setup listener for real-time updates
    const unsubscribe = listenToPageById(params.id, async (data) => {
      if (data) {
        const { pageData, versionData, links } = data;
        console.log('SinglePageView - Full data received:', data);
        console.log('SinglePageView - Version data content:', versionData?.content);

        // Set state with the fetched data
        setPage({ ...pageData, id: params.id });
        if (versionData && versionData.content) {
          console.log('Setting editor state with:', versionData.content);
          setEditorState(versionData.content);
        } else {
          console.warn('No version content available');
        }
        setTitle(pageData.title);

        // Fetch author username if not a group page
        if (pageData.userId && !pageData.groupId) {
          const userRef = ref(rtdb, `users/${pageData.userId}`);
          const userSnap = await get(userRef);
          if (userSnap.exists()) {
            setAuthorUsername(userSnap.val().username);
          }
        }

        // Check and set groupId and fetch group name if it exists
        if (pageData.groupId) {
          setGroupId(pageData.groupId);
          const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
          const groupSnap = await get(groupRef);
          if (groupSnap.exists()) {
            const groupData = groupSnap.val();
            setGroupName(groupData.name);
            // Calculate member count from the members object
            setGroupMemberCount(groupData.members ? Object.keys(groupData.members).length : 0);
          }
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
        console.log('No page data received');
        setPage(null);
        setIsLoading(false);
      }
    });

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, [params.id, user]);

  // Add debug logs for render
  console.log('Current editorState:', editorState);
  console.log('Current page:', page);
  console.log('Is editing:', isEditing);

  // Add function to fetch user's groups
  const fetchUserGroups = async () => {
    if (!user) return;
    const userGroupsRef = ref(rtdb, `users/${user.uid}/groups`);
    const snapshot = await get(userGroupsRef);
    if (snapshot.exists()) {
      const groupIds = Object.keys(snapshot.val());
      const groupsData = await Promise.all(
        groupIds.map(async (groupId) => {
          const groupRef = ref(rtdb, `groups/${groupId}`);
          const groupSnap = await get(groupRef);
          if (groupSnap.exists()) {
            const data = groupSnap.val();
            return {
              id: groupId,
              name: data.name,
              memberCount: data.members ? Object.keys(data.members).length : 0
            };
          }
          return null;
        })
      );
      setUserGroups(groupsData.filter(Boolean));
    }
  };

  // Update handleBylineClick to handle both personal and group clicks
  const handleBylineClick = async () => {
    // If the user owns the page, show the dropdown regardless of group status
    if (user && user.uid === page.userId) {
      await fetchUserGroups();
      setShowDropdown(!showDropdown);
    } else if (groupId) {
      // If user doesn't own the page but it's in a group, navigate to group
      router.push(`/groups/${groupId}`);
    } else if (page.userId) {
      // If user doesn't own the page and it's not in a group, navigate to user
      router.push(`/user/${page.userId}`);
    }
  };

  // Add function to handle ownership changes
  const handleOwnershipChange = async (newGroupId = null) => {
    if (!user || !page) return;
    
    try {
      // Update page in Firestore
      const pageRef = doc(db, "pages", page.id);
      await updateDoc(pageRef, {
        groupId: newGroupId,
        userId: user.uid,
        lastModified: new Date().toISOString()
      });
      
      // Update RTDB group references
      const rtdbUpdates = {};
      
      // Remove page from old group if it exists
      if (page.groupId) {
        rtdbUpdates[`groups/${page.groupId}/pages/${page.id}`] = null;
      }
      
      // Add page to new group if specified
      if (newGroupId) {
        rtdbUpdates[`groups/${newGroupId}/pages/${page.id}`] = {
          title: page.title,
          userId: user.uid,
          lastModified: new Date().toISOString()
        };
      }
      
      // Apply RTDB updates if there are any
      if (Object.keys(rtdbUpdates).length > 0) {
        await update(ref(rtdb), rtdbUpdates);
      }
      
      // Update local state
      if (newGroupId) {
        // If switching to a group, find the group data from userGroups
        const selectedGroup = userGroups.find(g => g.id === newGroupId);
        if (selectedGroup) {
          setGroupId(newGroupId);
          setGroupName(selectedGroup.name);
          setGroupMemberCount(selectedGroup.memberCount);
          setAuthorUsername(null); // Clear author username when switching to group
        }
      } else {
        // If switching back to personal ownership
        setGroupId(null);
        setGroupName(null);
        setGroupMemberCount(0);
        // Set author username back to current user
        const userRef = ref(rtdb, `users/${user.uid}`);
        const userSnap = await get(userRef);
        if (userSnap.exists()) {
          setAuthorUsername(userSnap.val().username);
        }
      }

      // Update the page object to reflect changes
      setPage(prev => ({
        ...prev,
        groupId: newGroupId,
        userId: user.uid
      }));
      
      setShowDropdown(false);
    } catch (error) {
      console.error('Error updating page ownership:', error);
    }
  };

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
      <div className="px-4 py-8 pb-32">
        <div className="block md:flex md:items-center md:gap-3 mb-6">
          <h1 className="text-3xl font-bold mb-2 md:mb-0">{title}</h1>
          <div className="flex items-center gap-2">
            {groupName ? (
              <div 
                onClick={handleBylineClick}
                className="bg-[#1C1C1C] hover:bg-[#2C2C2C] rounded-full px-3 py-1 flex items-center gap-2 cursor-pointer relative"
              >
                <span className="text-text-secondary">in</span>
                <span>{groupName}</span>
                <Icon icon="ph:users" className="w-4 h-4" />
                <span>{groupMemberCount}</span>
                {showDropdown && user && user.uid === page.userId && (
                  <div className="absolute top-full left-0 mt-2 w-64 rounded-md shadow-lg bg-[#1C1C1C] ring-1 ring-black ring-opacity-5 z-50">
                    <div className="p-4">
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Icon icon="ph:pencil-simple" className="w-4 h-4" />
                        Page owner
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleOwnershipChange()}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[#2C2C2C] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span>Myself:</span>
                            <div className="flex items-center gap-1 bg-[#2C2C2C] rounded-full px-2 py-0.5">
                              <span>{authorUsername}</span>
                              <Icon icon="flag:us-4x3" className="w-3 h-3" />
                            </div>
                          </div>
                          {!page.groupId && <Icon icon="ph:check-bold" className="w-4 h-4" />}
                        </button>
                        
                        <div className="text-sm text-text-secondary mt-4 mb-2">One of my groups:</div>
                        {userGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => handleOwnershipChange(group.id)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[#2C2C2C] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-[#2C2C2C] rounded-full px-2 py-0.5">
                                <span>{group.name}</span>
                                <Icon icon="ph:users" className="w-3 h-3" />
                                <span>{group.memberCount}</span>
                              </div>
                            </div>
                            {page.groupId === group.id && <Icon icon="ph:check-bold" className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div 
                onClick={handleBylineClick}
                className="bg-[#1C1C1C] hover:bg-[#2C2C2C] rounded-full px-3 py-1 flex items-center gap-2 cursor-pointer relative"
              >
                <span className="text-text-secondary">by</span>
                <span>{authorUsername || 'username'}</span>
                <Icon icon="flag:us-4x3" className="w-4 h-4" />
                {showDropdown && user && user.uid === page.userId && (
                  <div className="absolute top-full left-0 mt-2 w-64 rounded-md shadow-lg bg-[#1C1C1C] ring-1 ring-black ring-opacity-5 z-50">
                    <div className="p-4">
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Icon icon="ph:pencil-simple" className="w-4 h-4" />
                        Page owner
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleOwnershipChange()}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[#2C2C2C] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span>Myself:</span>
                            <div className="flex items-center gap-1 bg-[#2C2C2C] rounded-full px-2 py-0.5">
                              <span>{authorUsername}</span>
                              <Icon icon="flag:us-4x3" className="w-3 h-3" />
                            </div>
                          </div>
                          {!page.groupId && <Icon icon="ph:check-bold" className="w-4 h-4" />}
                        </button>
                        
                        <div className="text-sm text-text-secondary mt-4 mb-2">One of my groups:</div>
                        {userGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => handleOwnershipChange(group.id)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[#2C2C2C] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-[#2C2C2C] rounded-full px-2 py-0.5">
                                <span>{group.name}</span>
                                <Icon icon="ph:users" className="w-3 h-3" />
                                <span>{group.memberCount}</span>
                              </div>
                            </div>
                            {page.groupId === group.id && <Icon icon="ph:check-bold" className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          <EditPage
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            page={page}
            current={editorState}
            title={title}
            setTitle={setTitle}
          />
        ) : (
          <>
            <TextView content={editorState} />
            <div>
              <PageMetadata page={page} hidePageOwner={true} />
            </div>
            <ActionRow
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              page={page}
            />
          </>
        )}

        {/* Pledge bar at the bottom */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full px-4 md:px-0">
          <div className="max-w-[400px] mx-auto">
            <PledgeBar pageId={params.id} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
