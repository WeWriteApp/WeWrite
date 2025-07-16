"use client";

import React, { useState, useEffect } from "react";
import { PageActions } from "./PageActions";
import WordCounter from "../editor/WordCounter";
import PageStats from "./PageStats";
import CustomDateField from "./CustomDateField";
import LocationField from "./LocationField";
import dynamic from "next/dynamic";
import { Button } from "../ui/button";
import { Reply } from "lucide-react";


// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('../utils/AddToPageButton'), {
  ssr: false,
  loading: () => <div className="h-8 w-24 bg-muted animate-pulse rounded-md"></div>
});
import { getPageViewsLast24Hours, getPageTotalViews } from "../../firebase/pageViews";
import { getPageVersions } from "../../firebase/database";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { getPagePledgeStats, getSupporterSparklineData } from "../../services/pledgeStatsService";
import { useFeatureFlag } from "../../utils/feature-flags";
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
 * @param {Function} onSave - Function to save page changes (for edit mode)
 * @param {Function} onCancel - Function to cancel editing (for edit mode)
 * @param {Function} onDelete - Function to delete page (for edit mode)
 * @param {Function} onInsertLink - Function to insert link (for edit mode)
 * @param {boolean} isSaving - Whether page is currently being saved
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
export default function PageFooter({
  page,
  content,
  isOwner,
  isEditing,
  setIsEditing,
  onSave,
  onCancel,
  onDelete,
  onInsertLink,
  isSaving,
  hasUnsavedChanges
}) {
  const { currentAccount } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);
  const [viewData, setViewData] = useState({ total: 0, hourly: [] });
  const [changeData, setChangeData] = useState({ count: 0, hourly: [] });
  const [supporterData, setSupporterData] = useState({ count: 0, hourly: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Use a ref to track if we've already fetched data for this page
  const dataFetched = React.useRef(new Set());

  useEffect(() => {
    if (!page || !page.id) return;

    // Skip if we've already fetched data for this page
    if (dataFetched.current.has(page.id)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Mark that we're fetching data for this page
        dataFetched.current.add(page.id);
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

        // Fetch supporter data (only if payments are enabled)
        if (isPaymentsEnabled) {
          const pledgeStats = await getPagePledgeStats(page.id);
          const supporterSparkline = await getSupporterSparklineData(page.id);

          setSupporterData({
            count: pledgeStats.sponsorCount,
            hourly: supporterSparkline
          });
        }
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
      {/* Word and character count - centered above action buttons */}
      {!isEditing && content && (
        <div className="mb-4 flex justify-center w-full">
          <WordCounter content={content} />
        </div>
      )}

      {/* Show PageActions when not in edit mode */}
      {!isEditing && (
        <div className="mb-6 flex flex-col w-full md:flex-row md:flex-wrap md:items-center md:justify-between gap-4">
          <PageActions
            page={page}
            content={content}
            isOwner={isOwner}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            className="action-buttons-container"
            showFollowButton={currentAccount && !isOwner}
          />
        </div>
      )}

      {/* Similar pages section removed to conserve resources */}

      {/* Custom Date Field - show in both edit and view modes for all pages */}
      <div className="mb-6">
        <CustomDateField
          customDate={page.customDate}
          canEdit={isOwner}
          onCustomDateChange={async (newDate) => {
            try {
              const response = await fetch(`/api/pages/${page.id}/custom-date`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ customDate: newDate }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update custom date');
              }

              // Update the page object to reflect the change
              if (page) {
                page.customDate = newDate;
              }

              console.log('Custom date updated successfully to:', newDate);
            } catch (error) {
              console.error('Error updating custom date:', error);
              // TODO: Show user-friendly error message
            }
          }}
        />
      </div>

      {/* Location Field - show in both edit and view modes for all pages */}
      <div className="mb-6">
        <LocationField
          location={page.location}
          canEdit={isOwner}
          onLocationChange={async (newLocation) => {
            try {
              const response = await fetch(`/api/pages/${page.id}/location`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ location: newLocation }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update location');
              }

              // Update the page object to reflect the change
              if (page) {
                page.location = newLocation;
              }

              console.log('Location updated successfully');
            } catch (error) {
              console.error('Error updating location:', error);
              // TODO: Show user-friendly error message
            }
          }}
        />
      </div>

      {/* Page stats section - only in view mode */}
      {!isEditing && (
        <PageStats
          viewCount={viewData.total}
          viewData={viewData.hourly}
          changeCount={changeData.count}
          changeData={changeData.hourly}
          supporterCount={isPaymentsEnabled ? supporterData.count : undefined}
          supporterData={isPaymentsEnabled ? supporterData.hourly : undefined}
          pageId={page.id}
        />
      )}

      {/* Construction chip removed */}
    </div>
  );
}