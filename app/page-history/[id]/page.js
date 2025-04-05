"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions, getPageById } from '../../firebase/database';
import DashboardLayout from '../../DashboardLayout';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader } from '../../components/Loader';

export default function PageHistoryPage({ params }) {
  const { id } = params;
  const [versions, setVersions] = useState([]);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch page details
        const pageData = await getPageById(id);
        setPage(pageData);

        // Fetch page versions
        const pageVersions = await getPageVersions(id);

        // Sort versions by timestamp in descending order (newest first)
        const sortedVersions = pageVersions.sort((a, b) => b.timestamp - a.timestamp);
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
  const isValidTimestamp = (timestamp) => {
    if (!timestamp) return false;

    // Check if it's a valid number or string that can be parsed
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  };

  const handleBackToPage = () => {
    router.push(`/${id}`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-screen">
          <Loader />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex items-center mb-4">
            <Button variant="ghost" onClick={handleBackToPage} className="mr-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <div className="text-destructive text-center p-8">
            <p>{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBackToPage} className="mr-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to page
          </Button>
          <h1 className="text-2xl font-bold flex-1 truncate">
            {page?.title || 'Page'} History
          </h1>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Change History</h2>
          </div>

          {versions.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">No history available for this page</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={index} className="p-4 border rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {version.action || 'Updated'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {version.username || 'Anonymous'} • {isValidTimestamp(version.timestamp) ? formatDistanceToNow(new Date(version.timestamp)) : 'some time'} ago
                      </div>
                      {isValidTimestamp(version.timestamp) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(version.timestamp), 'PPpp')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
