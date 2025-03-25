"use client";

import React from "react";
import { PageActions } from "./PageActions";

export default function PageFooter({ page, isOwner, isEditing, setIsEditing }) {
  if (!page) return null;
  
  return (
    <div className="mt-8 border-t border-border pt-4">
      <PageActions 
        page={page}
        isOwner={isOwner}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
      />
    </div>
  );
}
