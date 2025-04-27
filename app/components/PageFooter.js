"use client";

import React, { useState, useEffect, useContext } from "react";
import { PageActions } from "./PageActions";
import WordCounter from "./WordCounter";
import PageStats from "./PageStats";
// ConstructionChip removed
import FollowButton from "./FollowButton";
import dynamic from "next/dynamic";

// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('./AddToPageButton'), {
  ssr: false,
  loading: () => <div className="h-8 w-24 bg-muted animate-pulse rounded-md"></div>
});
import { getPageViewsLast24Hours, getPageTotalViews } from "../firebase/pageViews";
import { getPageVersions } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";

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
  const { user } = useContext(AuthContext);
  const [viewData, setViewData] = useState({ total: 0, hourly: [] });
  const [changeData, setChangeData] = useState({ count: 0, hourly: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!page || !page.id) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch view data
        const views = await getPageViewsLast24Hours(page.id);
        if (views.total === 0) {
          const totalViews = await getPageTotalViews(page.id);
          setViewData({ total: totalViews, hourly: Array(24).fill(0) });
        } else {
          setViewData(views);
        }

        // Fetch version data
        const versions = await getPageVersions(page.id);

        // Generate hourly data for changes
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        // Create 24 hourly buckets
        const hourlyBuckets = Array(24).fill(0);

        // Count versions in each hourly bucket
        versions.forEach(version => {
          if (version.createdAt) {
            const versionDate = version.createdAt instanceof Date ?
              version.createdAt : new Date(version.createdAt);

            if (versionDate >= yesterday && versionDate <= now) {
              const hourDiff = 23 - Math.floor((now - versionDate) / (1000 * 60 * 60));
              if (hourDiff >= 0 && hourDiff < 24) {
                hourlyBuckets[hourDiff]++;
              }
            }
          }
        });

        setChangeData({
          count: versions.length,
          hourly: hourlyBuckets
        });
      } catch (error) {
        console.error("Error fetching page stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page]);

  if (!page) return null;

  return (
    <div className="mt-10 border-t-only pt-6 pb-6 px-4 sm:px-6">
      <div className="mb-6 flex flex-col w-full md:flex-row md:flex-wrap md:items-center md:justify-between gap-4">
        {/* Action buttons - Follow and Add to Page */}
        {!isEditing && user && (
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Only show Follow button if not the owner */}
            {!isOwner && (
              <>
                <FollowButton
                  pageId={page.id}
                  pageTitle={page.title}
                  pageOwnerId={page.userId}
                  className="w-full md:w-auto"
                />
                <a
                  href={`/new?replyTo=${page.id}&page=${encodeURIComponent(page.title)}&username=${encodeURIComponent(page.username || '')}`}
                  className="w-full md:w-auto mt-2 inline-block"
                >
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full md:w-auto">
                    Reply to page
                  </button>
                </a>
              </>
            )}
            {/* Always show Add to Page button */}
            <AddToPageButton page={page} />
          </div>
        )}

        <PageActions
          page={page}
          content={content}
          isOwner={isOwner}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          className="action-buttons-container"
        />
      </div>

      {/* Word and character count */}
      {!isEditing && content && (
        <div className="mt-4 mb-6 flex flex-wrap gap-4 items-center">
          <WordCounter content={content} />
        </div>
      )}

      {/* Similar pages section removed to conserve resources */}

      {/* Page stats section */}
      {!isEditing && (
        <PageStats
          viewCount={viewData.total}
          viewData={viewData.hourly}
          changeCount={changeData.count}
          changeData={changeData.hourly}
          pageId={page.id}
        />
      )}

      {/* Construction chip removed */}
    </div>
  );
}
