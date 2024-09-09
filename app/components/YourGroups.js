"use client";
import React, { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import GroupBadge from "./GroupBadge";

export default function YourGroups() {
  const { user } = useContext(AuthContext);

  if (!user.groups) return null;
  return (
    <div className="grid md:grid-cols-4 grid-cols-1 gap-4 mb-4">
      {Object.keys(user.groups).map((groupId,index) => (
        <GroupBadge key={groupId} groupId={groupId} index={index} />
      ))}
    </div>
  );
}