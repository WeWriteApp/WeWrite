"use client";

import React, { useState, useEffect, useContext } from "react";
import { PageActions } from "./PageActions";
import WordCounter from "./WordCounter";
import SimilarPages from "./SimilarPages";
import PageStats from "./PageStats";
import ConstructionChip from "./ConstructionChip";

import { getPageViewsLast24Hours, getPageTotalViews } from "../firebase/pageViews";
import { getPageVersions } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 * @param {Date} date - The date to format
 * @returns {string} - A human-readable relative time string
 */
const formatRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffMonth / 12);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  if (diffDay < 30) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`;
  return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`;
};

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
      <div className="mb-6">
        <PageActions
          page={page}
          content={content}
          isOwner={isOwner}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          className="action-buttons-container w-full"
        />
      </div>

      {/* Word and character count */}
      {!isEditing && content && (
        <div className="mt-4 mb-6 flex flex-wrap gap-4 items-center">
          <WordCounter content={content} />
          {page.lastModified && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                last edited {formatRelativeTime(new Date(page.lastModified))}
              </span>
            </>
          )}
        </div>
      )}

      {/* Similar pages section */}
      {!isEditing && (
        <SimilarPages currentPage={page} maxPages={3} />
      )}

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

      {/* Construction chip - always visible except in edit mode */}
      {!isEditing && <ConstructionChip />}
    </div>
  );
}
