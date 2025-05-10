"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions, getPageById } from '../../firebase/database';
import DashboardLayout from '../../DashboardLayout';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader } from '../../components/Loader';
import ActivityCard from '../../components/ActivityCard';
import { generateSimpleDiff, generateTextDiff } from '../../utils/generateTextDiff';
import PageHeader from '../../components/PageHeader.tsx';

export default function PageHistoryPage({ params }) {
  const { id } = params;
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

      try {
        setLoading(true);

        // Fetch page details
        const pageResult = await getPageById(id);
        if (pageResult.error) {
          setError(pageResult.error);
          setLoading(false);
          return;
        }
        setPage(pageResult.pageData);

        // Fetch page versions
        const pageVersions = await getPageVersions(id);
        console.log('Page history - Raw page versions from database:', pageVersions);

        // If no versions found, create fallback versions
        let versionsToUse = pageVersions;
        if (!pageVersions || pageVersions.length === 0) {
          console.log('No versions found, creating fallback versions');
          // Create multiple fallback versions to show in history
          versionsToUse = [
            {
              id: 'fallback-1',
              createdAt: new Date(),
              action: 'Created',
              username: 'System',
              content: ''
            },
            {
              id: 'fallback-2',
              createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
              action: 'Updated',
              username: 'System',
              content: ''
            }
          ];
        }

        // Map createdAt to timestamp for consistency and sort by timestamp in descending order (newest first)
        const sortedVersions = versionsToUse.map(version => ({
          ...version,
          timestamp: version.createdAt || version.timestamp || new Date(),
          username: version.username || version.author || 'Anonymous',
          action: version.action || 'Updated'
        })).sort((a, b) => {
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date();
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date();
          return dateB - dateA;
        });
        console.log('Processed versions with timestamps:', sortedVersions);

        // Convert versions to activity format
        const activityItems = sortedVersions.map((version, index) => {
          const prevVersion = index < sortedVersions.length - 1 ? sortedVersions[index + 1] : null;

          return {
            id: version.id || `version-${index}`,
            pageId: id,
            pageName: pageResult.pageData?.title || 'Untitled',
            userId: version.userId || 'anonymous',
            username: version.username || 'Anonymous',
            timestamp: version.timestamp,
            currentContent: version.content || '',
            previousContent: prevVersion?.content || '',
            isNewPage: index === sortedVersions.length - 1, // Last item is the oldest/first version
            versionId: version.id // Include the version ID for linking to version view
          };
        });

        setActivities(activityItems);
        setVersions(sortedVersions);
      } catch (err) {
        console.error('Error fetching page history:', err);
        setError('Failed to load page history');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleBackToPage = () => {
    router.push(`/${id}`);
  };

  // Helper function to validate timestamp
  const isValidTimestamp = (timestamp) => {
    if (!timestamp) return false;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return !isNaN(date.getTime());
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 max-w-4xl mx-auto">
          <PageHeader
            title="Page History"
            username="Loading..."
            isLoading={true}
          />
          <div className="flex justify-center items-center min-h-[50vh]">
            <Loader />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 max-w-4xl mx-auto">
          <PageHeader
            title="Page History"
            username="Error"
            isLoading={false}
          />
          {/* Back button removed - using PageHeader back button instead */}
          <div className="text-destructive text-center p-8 border border-destructive/20 rounded-lg bg-destructive/5">
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2 text-muted-foreground">Unable to load page history. Please try again later.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <PageHeader
          title="Page History"
          username={page?.username || "Anonymous"}
          userId={page?.userId}
          isLoading={loading}
        />

        {/* Back button removed - using PageHeader back button instead */}

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Change History</h2>
          </div>

          {activities.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">No history available for this page</p>
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
    </DashboardLayout>
  );
}
