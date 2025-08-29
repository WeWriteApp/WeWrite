"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getPageById } from '../../firebase/database';
import { getPageVersions } from '../../services/versionService';
import { Button } from '../../components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import UnifiedLoader from '../../components/ui/unified-loader';
import ActivityCard from '../../components/activity/ActivityCard';
import { getDiff } from '../../utils/diffService';
import ContentPageHeader from '../../components/pages/ContentPageHeader';
import { useAuth } from '../../providers/AuthProvider';

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
  const [page, setPage] = useState(null);
  const [versions, setVersions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

        // Fetch page details
        const pageResult = await getPageById(id, user?.uid);
        if (pageResult.error) {
          setError(pageResult.error);
          setLoading(false);
          return;
        }
        let pageData = pageResult.pageData;



        setPage(pageData);

        // Fetch page versions using the dedicated page versions API
        console.log('Page versions - Attempting to fetch versions for page:', id);
        const versionsResponse = await fetch(`/api/pages/${id}/versions?limit=50&includeNoOp=false`, {
          credentials: 'include', // Include authentication cookies
          headers: {
            'Content-Type': 'application/json',
          },
        });
        let pageVersions = [];

        console.log('Page versions - API response status:', versionsResponse.status);

        if (versionsResponse.ok) {
          const versionsData = await versionsResponse.json();
          pageVersions = versionsData.data?.versions || versionsData.versions || [];
          console.log('Page versions - Fetched from versions API:', pageVersions.length, 'versions');
          console.log('Page versions - Full API response:', versionsData);
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
          console.log('Trying fallback to old version system');
          const fallbackVersions = await getPageVersions(id);
          pageVersions = fallbackVersions || [];
          console.log('Page versions - Fallback versions:', pageVersions.length, 'versions');
        }

        // Convert page versions to activity format for display
        let activityItems = [];

        if (pageVersions.length > 0) {
          // Use page versions data from the dedicated API
          console.log('Using page versions data for versions page:', pageVersions.length, 'versions');

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

            return {
              id: version.id || `version-${index}`,
              pageId: id,
              pageName: version.title || pageResult.pageData?.title || 'Untitled',
              userId: version.userId,
              username: version.username || 'Anonymous',
              displayName: version.username || 'Anonymous',
              timestamp: version.createdAt || version.timestamp,
              currentContent: version.content || '',
              previousContent: previousContent,
              diff: diff,
              diffPreview: diffPreview,
              isNewPage: !previousContent, // First version if no previous content
              versionId: version.id,
              isActivityContext: true,
              isCurrentVersion: index === 0, // First item is most recent
              hasPreviousVersion: index < pageVersions.length - 1, // Has previous version if not the last item
              // Add subscription data - UsernameBadge will fetch this automatically based on userId
              subscriptionTier: version.subscriptionTier || null,
              hasActiveSubscription: version.hasActiveSubscription || false,
              subscriptionAmount: version.subscriptionAmount || null
            };
          }));

          console.log('Page versions - Converted to activity items with calculated diffs:', activityItems.length, 'items');
        } else {
          // No versions found
          console.log('No versions found for this page');
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Versions page - setting activities:', activityItems.length, 'items');
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
        <ContentPageHeader
          title="Page Versions"
          username="Loading..."
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
        <ContentPageHeader
          title={page?.title || "Page History"}
          username={page?.username}
          userId={page?.userId}
          isLoading={false}
        />
        {/* Back button removed - using ContentPageHeader back button instead */}
        <div className="text-destructive text-center p-8 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="font-medium">{error}</p>
          <p className="text-sm mt-2 text-muted-foreground">Unable to load page versions. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <ContentPageHeader
          title={page?.title || "Page History"}
          username={page?.username}
          userId={page?.userId}
          isLoading={loading}
        />

        {/* Back button removed - using ContentPageHeader back button instead */}

        <div className="mb-6">
          {activities.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">No versions available for this page</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.map((activity, index) => (
                <ActivityCard key={index} activity={activity} />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
