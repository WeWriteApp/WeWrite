"use client";
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { rtdb } from '../../firebase/rtdb'
import { onValue, ref, push } from "firebase/database";
import { useRouter } from "next/navigation";

export default function Page() {
  const { user } = useContext(AuthContext)
  const router = useRouter();
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    isPublic: true,
  });

  const handleSave = async () => {
    console.log("Saving group", newGroup);

    let member = {}
    member[user.uid] = {
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
    <div className="p-4">
      <h1
        className="text-2xl font-semibold"
      >New Group</h1>
      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Name:
          <input 
            className="border border-gray-500 rounded-md p-2"
          type="text" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          Description:
          <textarea 
            className="border border-gray-500 rounded-md p-2"
          value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} />
        </label>
        <label className="flex flex-row gap-1">
          Is Public:
          <input 
            className="border border-gray-500 rounded-md p-2"
          type="checkbox" checked={newGroup.isPublic} onChange={e => setNewGroup({ ...newGroup, isPublic: e.target.checked })} />
        </label>
        <div className="flex flex-row gap-4">
          <button 
            className="bg-white w-auto inline-block text-black px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-500 hover:text-white"
          type="button" onClick={handleSave}>Save</button>
        </div>
      </form>
    </div>
  );
}
