"use client";
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { rtdb } from '../../firebase/rtdb';
import { onValue, ref, push } from "firebase/database";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { MultiSelect } from "../../components/ui/multi-select";
import { searchUsers } from "../../firebase/database";
import { useFeatureFlag } from "../../utils/feature-flags";
import VisibilityDropdown from "../../components/VisibilityDropdown";

export default function Page() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const groupsEnabled = useFeatureFlag('groups', user?.email);
  const [newGroup, setNewGroup] = useState({
    name: "",
    isPublic: true,
  });

  // Check if groups feature is enabled
  useEffect(() => {
    if (!groupsEnabled) {
      console.log('[DEBUG] New group page - Feature disabled, redirecting to home');
      router.push('/');
    }
  }, [groupsEnabled, router]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchUsers(query);
      // Filter out the current user from search results
      const filteredUsers = users.filter(u => u.id !== user.uid);

      // Map to format expected by MultiSelect
      setSearchResults(filteredUsers.map(u => ({
        id: u.id,
        label: u.username || u.email
      })));
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = (member) => {
    setSelectedMembers([...selectedMembers, member]);
    setSearchResults([]);
  };

  const handleRemoveMember = (member) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== member.id));
  };

  const handleSave = async () => {
    console.log("Saving group", newGroup);

    // Add current user as owner
    let members = {};
    members[user.uid] = {
      role: "owner",
      joinedAt: new Date().toISOString()
    };

    // Add selected members
    selectedMembers.forEach(member => {
      members[member.id] = {
        role: "member",
        joinedAt: new Date().toISOString()
      };
    });

    let data = {
      ...newGroup,
      owner: user.uid,
      members: members,
      createdAt: new Date().toISOString(),
    };

    console.log("Saving group", data);

    const newGroupRef = push(ref(rtdb, 'groups'), data);

    router.push(`/group/${newGroupRef.key}`);
  };

  return (
    <div className="p-4 bg-background text-text">
      <div className="flex items-center mb-4">
        <Button
          variant="outline"
          size="icon"
          className="mr-2"
          onClick={() => router.push('/')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">New Group</h1>
      </div>

      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Name:
          <input
            className="border border-gray-500 rounded-md p-2 bg-background text-text"
            autoComplete="off"
            type="text"
            value={newGroup.name}
            onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          Members:
          <MultiSelect
            items={searchResults}
            selectedItems={selectedMembers}
            onItemSelect={handleAddMember}
            onItemRemove={handleRemoveMember}
            placeholder="Add members to your group..."
            searchPlaceholder="Search for users..."
            onSearch={handleSearch}
            loading={isSearching}
            className="bg-background text-text"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Search for users by username or email
          </p>
        </label>

        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium">Visibility:</label>
          <VisibilityDropdown
            isPublic={newGroup.isPublic}
            onVisibilityChange={(isPublic) => setNewGroup({ ...newGroup, isPublic })}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {newGroup.isPublic
              ? "Public groups can be found and viewed by anyone"
              : "Private groups are only visible to members"}
          </p>
        </div>

        <div className="flex flex-row gap-4 mt-2">
          <Button
            className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-500 hover:text-white"
            type="button"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
