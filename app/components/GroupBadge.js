"use client";
import React, { useState, useEffect } from "react";
import { rtdb } from '../firebase/rtdb'
import { onValue, ref } from "firebase/database";
import Link from "next/link";

export default function GroupBadge({ groupId,index }) {
  const [group, setGroup] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    const groupRef = ref(rtdb, `groups/${groupId}`);
    return onValue(groupRef, (snapshot) => {
      setGroup({
        id: snapshot.key,
        ...snapshot.val()
      });

      if (snapshot.val().members) {
        let count = Object.keys(snapshot.val().members).length;
        setMemberCount(count);
      }
      if (snapshot.val().pages) {
        let pageC = Object.keys(snapshot.val().pages).length;
        setPageCount(pageC);
      }
      
      
    });
  }, [groupId]);

  if (!group) return <div>Loading...</div>;

  return (
    <Link className="p-4 border bg-background border-gray-500 rounded-lg fade-in
    " href={`/groups/${group.id}`} style={{ animationDelay: `${index * 50}ms` }}>
      <h1
        className="text-lg font-semibold text-text"
      >{group.name}</h1>
      <p className="text-gray-600 text-sm mt-1"
      >{group.description}</p>
      <p className="text-gray-600 text-sm mt-1"
      >{memberCount} members | {pageCount} pages</p>
      
    </Link>
  );
}