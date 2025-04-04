"use client";

import React from "react";
import { PageActions } from "./PageActions";
import WordCounter from "./WordCounter";
import SimilarPages from "./SimilarPages";
import PageViewCounter from "./PageViewCounter";

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
  if (!page) return null;

  return (
    <div className="mt-10 border-t-only pt-6 pb-6 px-4 sm:px-6">
      <div className="mb-6">
        <PageActions
          page={page}
          content={content}
          isOwner={isOwner}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          className="action-buttons-container"
        />
      </div>

      {/* Word and character count + view counter */}
      {!isEditing && (
        <div className="mt-4 mb-6 flex flex-wrap gap-4 items-center">
          {content && <WordCounter content={content} />}
          <PageViewCounter pageId={page.id} />
        </div>
      )}

      {/* Similar pages section */}
      {!isEditing && (
        <SimilarPages currentPage={page} maxPages={3} />
      )}
    </div>
  );
}
