"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { PageActions } from "./PageActions";
import { CopyIcon, ReplyIcon, AddIcon } from "./icons";

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
 * - Increased button sizes for better mobile usability
 * 
 * This component is used in SinglePageView and replaces the previous
 * combination of PageInteractionButtons and ActionRow components.
 * 
 * @param {Object} page - The page data object
 * @param {Object} content - The content to be passed to PageActions
 * @param {boolean} isOwner - Whether the current user owns the page
 * @param {boolean} isEditing - Whether the page is currently in edit mode
 * @param {Function} setIsEditing - Function to toggle edit mode
 */
export default function PageFooter({ page, content, isOwner, isEditing, setIsEditing }) {
  const router = useRouter();
  if (!page) return null;
  
  return (
    <div className="mt-10 border-t border-border pt-6 pb-6 px-4 sm:px-6">
      <PageActions 
        page={page}
        content={content}
        isOwner={isOwner}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        className="action-buttons-container"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            <CopyIcon className="w-4 h-4" />
            Copy Link
          </button>
          <button
            onClick={() => router.push(`/pages/${page.id}/reply`)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            <ReplyIcon className="w-4 h-4" />
            Reply to Page
          </button>
          <button
            disabled
            title="Coming soon!"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 dark:text-gray-500 rounded-md cursor-not-allowed"
          >
            <AddIcon className="w-4 h-4" />
            Add to Page
          </button>
        </div>
      </PageActions>
    </div>
  );
}
