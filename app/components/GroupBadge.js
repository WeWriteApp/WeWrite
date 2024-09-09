"use client";
import React, { useState, useEffect } from "react";
import { rtdb } from '../firebase/rtdb'
import { onValue, ref } from "firebase/database";
import Link from "next/link";

export default function GroupBadge({ groupId }) {
  const [group, setGroup] = useState(null);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    const groupRef = ref(rtdb, `groups/${groupId}`);
    return onValue(groupRef, (snapshot) => {
      setGroup({
        id: snapshot.key,
        ...snapshot.val()
      });

      let count = Object.keys(snapshot.val().members).length;
      setMemberCount(count);
    });
  }, [groupId]);

  if (!group) return <div>Loading...</div>;

  return (
    <Link className="p-4 border border-gray-500 rounded-lg
    " href={`/groups/${group.id}`}>
      <h1
        className="text-2xl font-semibold"
      >{group.name}</h1>
      <p className="text-gray-500 text-sm"
      >{group.description} ({memberCount} members)</p>
      
    </Link>
  );
}