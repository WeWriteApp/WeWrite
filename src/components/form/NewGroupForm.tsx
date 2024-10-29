"use client";
import React, { useState, useEffect, useContext } from "react";
import { rtdb } from '../../firebase/rtdb'
import { onValue, ref, push } from "firebase/database";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/providers/AuthProvider";

export default function NewGroupForm() {
  const { user } = useContext<any>(AuthContext)
  const router = useRouter();
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    isPublic: true,
  });

  const handleSave = async () => {
    console.log("Saving group", newGroup);

    let member: any = {}
    member[user?.uid] = {
      role: "owner",
      joinedAt: new Date().toISOString()
    }
    let data = {
      ...newGroup,
      owner: user.uid,
      members: member,
      createdAt: new Date().toISOString(),
    }

    console.log("Saving group", data);

    const newGroupRef = push(ref(rtdb, 'groups'), data);

    router.push(`/groups/${newGroupRef.key}`);
  }

  return (
    <div className="p-4 bg-background text-text">
      <h1
        className="text-2xl font-semibold"
      >New Group</h1>
      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Name:
          <input
            className="border border-gray-500 rounded-md p-2 bg-background text-text" autoComplete="off"
            type="text" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          Description:
          <textarea
            className="border border-gray-500 rounded-md p-2 bg-background text-text"
            value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} />
        </label>
        <label className="flex flex-row gap-1">
          Is Public:
          <input
            className="border border-gray-500 rounded-md p-2" autoComplete="off"
            type="checkbox" checked={newGroup.isPublic} onChange={e => setNewGroup({ ...newGroup, isPublic: e.target.checked })} />
        </label>
        <div className="flex flex-row gap-4">
          <button
            className="bg-background w-auto inline-block text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-500 hover:text-white"
            type="button" onClick={handleSave}>Save</button>
        </div>
      </form>
    </div>
  );
}
