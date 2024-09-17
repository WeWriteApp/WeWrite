"use client";
import React, { useContext } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { rtdb } from "../firebase/rtdb";
import { ref, set } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import GroupMembers from "./GroupMembers";
import GroupPages from "./GroupPages";
import { useRouter } from "next/navigation";

export default function GroupDetails({ group }) {
  const { theme } = useTheme();
  if (!group) return <div>Loading...</div>;
  return (
    <div
      className="p-4 bg-background text-text min-h-screen"
      data-theme={theme}
    >
      <h1 className="text-3xl font-semibold">{group.name}</h1>
      <p>{group.description}</p>
      <DeleteGroupButton group={group} />
      {group.members && (
        <GroupMembers members={group.members} groupId={group.id} />
      )}
      {group.pages && <GroupPages pages={group.pages} />}
    </div>
  );
}

const DeleteGroupButton = ({ group }) => {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this group?")) {
      const groupRef = ref(rtdb, `groups/${group.id}`);
      set(groupRef, null);
      router.push("/pages");
    } 
  };
  if (!user || user.uid !== group.owner) return null;
  return (
    <button
      className="bg-background text-text border border-border px-4 py-2 rounded-lg"
      type="button"
      onClick={handleDelete}
    >
      Delete Group
    </button>
  );
};
