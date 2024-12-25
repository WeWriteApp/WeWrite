"use client";
import React, { useState, useEffect } from "react";
import { ref, onValue, rtdb } from "../firebase/rtdb";
import Link from "next/link";

export default function GroupBadge({ groupId, index }) {
  const [group, setGroup] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!groupId) return;

    const fetchGroup = async () => {
      try {
        const groupRef = await ref(`groups/${groupId}`);
        const unsubscribe = await onValue(groupRef, (snapshot) => {
          if (!snapshot.val()) return;

          const groupData = {
            id: snapshot.key,
            ...snapshot.val()
          };
          setGroup(groupData);

          if (groupData.members) {
            const count = Object.keys(groupData.members).length;
            setMemberCount(count);
          }
          if (groupData.pages) {
            const pageC = Object.keys(groupData.pages).length;
            setPageCount(pageC);
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching group:', error);
        setGroup({ name: 'Error loading group' });
      }
    };

    fetchGroup();
  }, [groupId]);

  if (!group || !groupId) return <div>Loading...</div>;

  return (
    <Link
      className="p-4 border bg-background border-gray-500 rounded-lg fade-in"
      href={`/groups/${group.id}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <h1 className="text-lg font-semibold text-text">{group.name}</h1>
      <p className="text-gray-600 text-sm mt-1">{group.description}</p>
      <p className="text-gray-600 text-sm mt-1">{memberCount} members | {pageCount} pages</p>
    </Link>
  );
}
