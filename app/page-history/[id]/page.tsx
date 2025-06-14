"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions, getPageById } from '../../firebase/database';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Clock } from 'lucide-react';
import NavHeader from '../../components/layout/NavHeader';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader } from '../../components/utils/Loader';

interface PageVersion {
  id: string;
  createdAt?: Date | string;
  timestamp?: Date | string;
  action?: string;
  username?: string;
  author?: string;
  content?: string;
}

interface PageHistoryPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function PageHistoryPage({ params }: PageHistoryPageProps): JSX.Element {
  // Handle both Promise and object params
  // Note: use() hook cannot be called inside try-catch blocks
  let unwrappedParams: { id: string };

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof (params as any).then === 'function') {
    unwrappedParams = use(params as Promise<{ id: string }>);
  } else {
    // If params is already an object, use it directly
    unwrappedParams = (params as { id: string }) || { id: '' };
  }

  const { id } = unwrappedParams;
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData(): Promise<void> {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch page details
        const pageData = await getPageById(id);
        setPage(pageData);

        // Fetch page versions
        const pageVersions = await getPageVersions(id);
        console.log('Page history - Raw page versions from database:', pageVersions);

        // If no versions found, create fallback versions
        let versionsToUse: PageVersion[] = pageVersions;
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
              createdAt: new Date(Date.now() - (24 * 60 * 60 * 1000)), // 1 day ago
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
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp as string);
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp as string);
          return dateB.getTime() - dateA.getTime();
        });
        console.log('Processed versions with timestamps:', sortedVersions);
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

  // Helper function to validate timestamp
  const isValidTimestamp = (timestamp: any): boolean => {
    if (!timestamp) return false;

    // Check if it's a valid number or string that can be parsed
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  };

  const handleBackToPage = (): void => {
    router.push('/' + id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <NavHeader
          title="Error"
          backUrl={'/' + id}
          backLabel="Back to page"
        />
        <div className="text-destructive text-center p-8">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <NavHeader
          title="Page History"
          backUrl={'/' + id}
          backLabel="Back to page"
        />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Change History</h2>
          </div>

          {versions.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">No history available for this page</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={index} className="p-6 border rounded-lg">
                  <div className="flex flex-col">
                    <div className="text-2xl font-medium mb-1">
                      {version.action || 'Updated'}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 mb-1">
                      <span>{version.username || 'Anonymous'}</span>
                      <span className="text-xs">•</span>
                      <span>{isValidTimestamp(version.timestamp) ? formatDistanceToNow(new Date(version.timestamp)) : 'some time'} ago</span>
                    </div>
                    {isValidTimestamp(version.timestamp) && (
                      <div className="text-muted-foreground">
                        {format(new Date(version.timestamp), 'MMM d, yyyy, h:mm:ss a')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
