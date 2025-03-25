"use client";

import React from "react";
import { PageActions } from "./PageActions";

/**
 * PageFooter Component
 * 
 * This component serves as a container for the PageActions component,
 * providing consistent styling and layout for the footer section of a page.
 * 
 * The footer includes:
 * - A border at the top for visual separation
 * - Proper padding and margins for spacing
 * - Responsive padding that adjusts to different screen sizes
 * 
 * This component is used in SinglePageView and replaces the previous
 * combination of PageInteractionButtons and ActionRow components.
 * 
 * @param {Object} page - The page data object
 * @param {boolean} isOwner - Whether the current user owns the page
 * @param {boolean} isEditing - Whether the page is currently in edit mode
 * @param {Function} setIsEditing - Function to toggle edit mode
 */
export default function PageFooter({ page, isOwner, isEditing, setIsEditing }) {
  if (!page) return null;
  
  return (
    <div className="mt-10 border-t border-border pt-6 pb-4 px-2 sm:px-4">
      <PageActions 
        page={page}
        isOwner={isOwner}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
      />
    </div>
  );
}
