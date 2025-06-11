"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions, getPageById } from '../../../firebase/database';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, GitCompare, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader } from '../../../components/utils/Loader';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import TextView from '../../../components/editor/TextView';
import TextViewErrorBoundary from '../../../components/editor/TextViewErrorBoundary.js';
import { generateDiffContent } from '../../../utils/diffUtils';
import { PageProvider } from '../../../contexts/PageContext';
import { LineSettingsProvider } from '../../../contexts/LineSettingsContext';
import PageHeader from '../../../components/pages/PageHeader';
import { useDateFormat } from '../../../contexts/DateFormatContext';

interface PageDiffProps {
  params: {
    id: string;
    versionId: string;
  };
}

export default function PageDiff({ params }: PageDiffProps) {
  const router = useRouter();
  const { formatDate } = useDateFormat();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [previousVersion, setPreviousVersion] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch page data
        const pageResult = await getPageById(params.id);
        if (!pageResult.success || !pageResult.pageData) {
          setError('Page not found');
          return;
        }
        setPage(pageResult.pageData);

        // Fetch all versions
        const pageVersions = await getPageVersions(params.id);
        if (!pageVersions || pageVersions.length === 0) {
          setError('No version history found');
          return;
        }

        // Sort versions by timestamp (newest first)
        const sortedVersions = pageVersions.map(version => ({
          ...version,
          timestamp: version.createdAt || version.timestamp || new Date(),
          username: version.username || version.author || 'Anonymous',
          action: version.action || 'Updated'
        })).sort((a, b) => {
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        });

        setVersions(sortedVersions);

        // Find the current version
        const current = sortedVersions.find(v => v.id === params.versionId);
        if (!current) {
          setError('Version not found');
          return;
        }
        setCurrentVersion(current);

        // Find the previous version (chronologically earlier)
        const currentIndex = sortedVersions.findIndex(v => v.id === params.versionId);
        const previous = currentIndex < sortedVersions.length - 1 ? sortedVersions[currentIndex + 1] : null;
        
        if (!previous) {
          setError('No previous version found for comparison');
          return;
        }
        setPreviousVersion(previous);

        // Generate diff content
        const currentContent = typeof current.content === 'string' 
          ? JSON.parse(current.content) 
          : current.content;
        
        let previousContent = null;
        if (current.previousContent && current.previousContent !== '' && current.previousContent !== '[]') {
          previousContent = typeof current.previousContent === 'string'
            ? JSON.parse(current.previousContent)
            : current.previousContent;
        } else if (previous.content) {
          previousContent = typeof previous.content === 'string'
            ? JSON.parse(previous.content)
            : previous.content;
        } else {
          previousContent = [];
        }

        const diffResult = generateDiffContent(currentContent, previousContent);
        setDiffContent(diffResult);

      } catch (err) {
        console.error('Error fetching diff data:', err);
        setError('Failed to load version comparison');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id, params.versionId]);

  const handleBackToHistory = () => {
    router.push('/' + params.id + '/history');
  };

  const handleBackToPage = () => {
    router.push('/' + params.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader show={true} message="Loading comparison..." id="diff-loader">
          <div />
        </Loader>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="Version Comparison"
        />
        <Alert className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <PageHeader
          title={page?.title || 'Untitled'}
        />

        {/* Comparison header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Version Comparison</h2>
          </div>
          
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Comparing versions:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackToPage}
                    >
                      View Current Page
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 border rounded bg-background/50">
                    <div className="font-medium text-green-600 dark:text-green-400 mb-1">
                      Selected Version
                    </div>
                    <div>{currentVersion?.username || 'Anonymous'}</div>
                    <div className="text-muted-foreground">
                      {currentVersion?.timestamp && formatDate(new Date(currentVersion.timestamp))}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {currentVersion?.timestamp && formatDistanceToNow(new Date(currentVersion.timestamp))} ago
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded bg-background/50">
                    <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                      Previous Version
                    </div>
                    <div>{previousVersion?.username || 'Anonymous'}</div>
                    <div className="text-muted-foreground">
                      {previousVersion?.timestamp && formatDate(new Date(previousVersion.timestamp))}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {previousVersion?.timestamp && formatDistanceToNow(new Date(previousVersion.timestamp))} ago
                    </div>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Diff content */}
        <div className="border-theme-strong rounded-lg p-4 mb-6">
          {diffContent ? (
            <PageProvider>
              <LineSettingsProvider>
                <TextViewErrorBoundary fallbackContent={
                  <div className="p-4 text-muted-foreground">
                    <p>Unable to display version comparison. The versions may have formatting issues.</p>
                    <p className="text-sm mt-2">Version ID: {params.versionId}</p>
                  </div>
                }>
                  <TextView
                    content={diffContent}
                    viewMode="normal"
                    showDiff={true}
                  />
                </TextViewErrorBoundary>
              </LineSettingsProvider>
            </PageProvider>
          ) : (
            <p className="text-muted-foreground text-center py-8">No content available for comparison</p>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBackToHistory}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to History
          </Button>
          
          <Button
            variant="outline"
            onClick={handleBackToPage}
          >
            View Current Page
          </Button>
        </div>
      </div>
    </div>
  );
}
