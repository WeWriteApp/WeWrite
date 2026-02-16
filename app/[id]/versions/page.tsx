"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
// Removed old Firebase import - using API route directly for consistency
import { getPageVersions } from '../../services/versionService';
import { Button } from '../../components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { formatDistanceToNow, format } from 'date-fns';
import UnifiedLoader from '../../components/ui/unified-loader';
import { InlineError } from '../../components/ui/InlineError';
import VersionActivityCard from '../../components/activity/VersionActivityCard';
import DiffTimelineChart from '../../components/activity/DiffTimelineChart';
import { getDiff } from '../../utils/diffService';
import PageVersionsHeader from '../../components/pages/PageVersionsHeader';
import { useAuth } from '../../providers/AuthProvider';

interface PageVersion {
  id: string;
  content: any;
  createdAt?: any;
  timestamp?: any;
  changeType?: string;
  titleChange?: boolean;
  diff?: { added: number; removed: number; hasChanges: boolean };
  versionId?: string;
  username?: string;
  tier?: string;  // Pre-computed effective tier from API
  hasActiveSubscription?: boolean;
  title?: string;
}

interface ActivityItem extends PageVersion {
  pageId: string;
  pageName: string;
  userId: string | null;
  displayName: string | null;
  previousContent?: any;
}

interface PageData {
  id: string;
  title?: string;
  content?: any;
  userId?: string;
}

interface PageVersionsPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function PageVersionsPage({ params }: PageVersionsPageProps) {
  // Handle both Promise and object params
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof (params as any).then === 'function') {
    unwrappedParams = use(params as Promise<{ id: string }>);
  } else {
    unwrappedParams = params as { id: string };
  }

  const { id } = unwrappedParams;
  const { user, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState<PageData | null>(null);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setError('No page ID provided');
        setLoading(false);
        return;
      }

      // Wait for authentication to load before making any Firebase calls
      if (authLoading) return;

      try {
        setLoading(true);

        // Fetch page details using API route for consistency
        const pageResponse = await fetch(`/api/pages/${id}${user?.uid ? `?userId=${user.uid}` : ''}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!pageResponse.ok) {
          setError('Failed to load page details');
          setLoading(false);
          return;
        }

        let responseData = await pageResponse.json();
        let pageData = responseData.pageData || responseData; // Handle both wrapped and direct responses


        setPage(pageData);

        // Fetch page versions using the dedicated page versions API
        const versionsResponse = await fetch(`/api/pages/${id}/versions?limit=50&includeNoOp=false`, {
          credentials: 'include', // Include authentication cookies
          headers: {
            'Content-Type': 'application/json',
          },
        });
        let pageVersions = [];


        if (versionsResponse.ok) {
          const versionsData = await versionsResponse.json();
          pageVersions = versionsData.data?.versions || versionsData.versions || [];
        } else {
          console.error('Failed to fetch page versions:', versionsResponse.status, versionsResponse.statusText);

          // Log the error response for debugging
          try {
            const errorData = await versionsResponse.json();
            console.error('Page versions - API error response:', errorData);
          } catch (e) {
            console.error('Page versions - Could not parse error response');
          }

          // Fallback to old version system if API fails
          const fallbackVersions = await getPageVersions(id);
          pageVersions = fallbackVersions || [];
        }

        // Convert page versions to activity format for display
        let activityItems = [];

        if (pageVersions.length > 0) {
          // Use page versions data from the dedicated API

          // Calculate diff previews for each version
          activityItems = await Promise.all(pageVersions.map(async (version, index) => {
            const previousVersion = index < pageVersions.length - 1 ? pageVersions[index + 1] : null;
            const previousContent = previousVersion?.content || '';

            // Calculate diff preview if we have both current and previous content
            let diffPreview = { beforeContext: '', addedText: '', removedText: '', afterContext: '', hasAdditions: false, hasRemovals: false };
            let diff = { added: 0, removed: 0, hasChanges: false };

            if (version.content && previousContent) {
              try {
                // Import the diff service to calculate the diff
                const { calculateDiff } = await import('../../utils/diffService');
                const diffResult = await calculateDiff(version.content, previousContent);

                if (diffResult) {
                  diff = {
                    added: diffResult.added || 0,
                    removed: diffResult.removed || 0,
                    hasChanges: diffResult.hasChanges || false
                  };

                  diffPreview = diffResult.preview || diffPreview;
                }
              } catch (error) {
                console.error('Error calculating diff for version:', version.id, error);
              }
            } else if (version.content && !previousContent) {
              // This is the first version, everything is "added"
              diff = { added: version.content.length, removed: 0, hasChanges: true };
              diffPreview = {
                beforeContext: '',
                addedText: version.content.substring(0, 100) + (version.content.length > 100 ? '...' : ''),
                removedText: '',
                afterContext: '',
                hasAdditions: true,
                hasRemovals: false
              };
            }

            // Check if this is a title change
            const isTitleChange = version.changeType === 'title_change' || version.changeType === 'content_and_title_change';
            const titleChange = version.titleChange;

            // For title changes, use title diff instead of content diff
            if (isTitleChange && titleChange) {
              try {
                const { calculateDiff } = await import('../../utils/diffService');
                const titleDiffResult = await calculateDiff(null, null, {
                  oldTitle: titleChange.oldTitle || '',
                  newTitle: titleChange.newTitle || ''
                });

                if (titleDiffResult) {
                  diff = {
                    added: titleDiffResult.added || 0,
                    removed: titleDiffResult.removed || 0,
                    hasChanges: true
                  };
                  diffPreview = titleDiffResult.preview || {
                    beforeContext: 'Title: ',
                    addedText: titleChange.newTitle || '',
                    removedText: titleChange.oldTitle || '',
                    afterContext: '',
                    hasAdditions: true,
                    hasRemovals: true
                  };
                }
              } catch (error) {
                console.error('Error calculating title diff for version:', error);
              }
            }

            return {
              id: version.id || `version-${index}`,
              pageId: id,
              pageName: '', // Remove page title from cards
              userId: null, // Remove user info from cards
              username: null, // Remove username from cards
              displayName: null, // Remove display name from cards

              timestamp: version.createdAt || version.timestamp,
              currentContent: version.content || '',
              previousContent: previousContent,
              diff: diff,
              diffPreview: diffPreview,
              isNewPage: !previousContent, // First version if no previous content
              changeType: version.changeType, // Include change type
              titleChange: titleChange, // Include title change data
              versionId: version.id,
              isActivityContext: true,
              isCurrentVersion: index === 0, // First item is most recent
              hasPreviousVersion: index < pageVersions.length - 1, // Has previous version if not the last item
              // Remove subscription data since we're not showing usernames
              tier: null,
              hasActiveSubscription: false
            };
          }));


        } else {
          // No versions found
        }

        if (process.env.NODE_ENV === 'development') {
        }
        setActivities(activityItems);
        setVersions(pageVersions); // Set versions from the API
      } catch (err) {
        console.error('Error fetching page versions:', err);
        setError('Failed to load page versions');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, authLoading, user?.uid]);

  const handleBackToPage = () => {
    router.push('/' + id);
  };

  // Helper function to validate timestamp
  const isValidTimestamp = (timestamp) => {
    if (!timestamp) return false;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return !isNaN(date.getTime());
  };

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <PageVersionsHeader
          pageTitle="Loading..."
          isLoading={true}
        />
        <UnifiedLoader
          isLoading={true}
          message="Loading page versions..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <PageVersionsHeader
          pageTitle={page?.title || "Unknown Page"}
          isLoading={false}
        />
        <InlineError
          message="Unable to load page versions. Please try again later."
          variant="error"
          size="lg"
          title={error}
          className="mt-20"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
        <PageVersionsHeader
          pageTitle={page?.title || 'Untitled'}
          isLoading={loading}
        />

        {/* Clean spacing for fixed header */}
        <div className="p-2" style={{ paddingTop: '120px' }}>
          {/* Diff Timeline Chart */}
          {activities.length > 1 && (
            <div className="mb-6 p-4 wewrite-card">
              <DiffTimelineChart
                data={activities.map(a => ({
                  added: a.diff?.added || 0,
                  removed: a.diff?.removed || 0,
                  timestamp: a.timestamp,
                  id: a.versionId
                }))}
                height={80}
                onBarClick={(index) => {
                  const activity = activities[index];
                  if (activity?.versionId) {
                    router.push(`/${id}/versions/${activity.versionId}`);
                  }
                }}
              />
            </div>
          )}

          {activities.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">No versions available for this page</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activities.map((activity, index) => (
                <VersionActivityCard key={index} activity={activity} />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
