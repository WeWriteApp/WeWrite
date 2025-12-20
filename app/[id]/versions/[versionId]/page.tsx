"use client";

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, SkipForward } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import { format } from 'date-fns';
import UnifiedLoader from '../../../components/ui/unified-loader';
import { InlineError } from '../../../components/ui/InlineError';
import ViewableContent from '../../../components/content/ViewableContent';
import { DiffStats } from '../../../components/activity/DiffPreview';
import { PageProvider } from '../../../contexts/PageContext';

interface VersionSnapshotPageProps {
  params: Promise<{ id: string; versionId: string }> | { id: string; versionId: string };
}

interface VersionData {
  id: string;
  content: string;
  createdAt: string;
  username?: string;
  title?: string;
  diff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
  diffPreview?: {
    beforeContext: string;
    addedText: string;
    removedText: string;
    afterContext: string;
    hasAdditions: boolean;
    hasRemovals: boolean;
  };
}

interface VersionNavInfo {
  id: string;
  title?: string;
  createdAt: string;
}

export default function VersionSnapshotPage({ params }: VersionSnapshotPageProps) {
  // Handle both Promise and object params
  let unwrappedParams;
  if (params && typeof (params as any).then === 'function') {
    unwrappedParams = use(params as Promise<{ id: string; versionId: string }>);
  } else {
    unwrappedParams = params as { id: string; versionId: string };
  }

  const { id: pageId, versionId } = unwrappedParams;
  const router = useRouter();

  const [version, setVersion] = useState<VersionData | null>(null);
  const [previousVersion, setPreviousVersion] = useState<VersionNavInfo | null>(null);
  const [nextVersion, setNextVersion] = useState<VersionNavInfo | null>(null);
  const [pageTitle, setPageTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allVersions, setAllVersions] = useState<{ id: string; createdAt: string }[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(-1);

  // Fetch version data
  const fetchVersionData = useCallback(async () => {
    if (!pageId || !versionId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch the specific version
      const response = await fetch(`/api/pages/${pageId}/versions/${versionId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load version');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setVersion(data.data.version);
        setPreviousVersion(data.data.previousVersion);
        setNextVersion(data.data.nextVersion);
        setPageTitle(data.data.pageTitle || 'Untitled');
      } else {
        throw new Error(data.error || 'Failed to load version');
      }

      // Also fetch all versions for the scrubber
      const versionsResponse = await fetch(`/api/pages/${pageId}/versions?limit=100`, {
        credentials: 'include',
      });

      if (versionsResponse.ok) {
        const versionsData = await versionsResponse.json();
        const versions = versionsData.data?.versions || versionsData.versions || [];
        setAllVersions(versions.map((v: any) => ({ id: v.id, createdAt: v.createdAt })));

        // Find current version index
        const idx = versions.findIndex((v: any) => v.id === versionId);
        setCurrentVersionIndex(idx);
      }

    } catch (err) {
      console.error('Error fetching version:', err);
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setLoading(false);
    }
  }, [pageId, versionId]);

  useEffect(() => {
    fetchVersionData();
  }, [fetchVersionData]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && previousVersion) {
        e.preventDefault();
        router.push(`/${pageId}/versions/${previousVersion.id}`);
      } else if (e.key === 'ArrowRight' && nextVersion) {
        e.preventDefault();
        router.push(`/${pageId}/versions/${nextVersion.id}`);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        router.push(`/${pageId}/versions`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageId, previousVersion, nextVersion, router]);

  const handleGoToPrevious = () => {
    if (previousVersion) {
      router.push(`/${pageId}/versions/${previousVersion.id}`);
    }
  };

  const handleGoToNext = () => {
    if (nextVersion) {
      router.push(`/${pageId}/versions/${nextVersion.id}`);
    }
  };

  const handleGoToCurrent = () => {
    if (allVersions.length > 0) {
      // First version in the list is the most recent (current)
      router.push(`/${pageId}/versions/${allVersions[0].id}`);
    }
  };

  const handleGoToVersionsList = () => {
    router.push(`/${pageId}/versions`);
  };

  const handleGoToPage = () => {
    router.push(`/${pageId}`);
  };

  // Parse content for viewing
  const parseContent = (content: string | undefined) => {
    if (!content) return null;
    try {
      return typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedLoader
          isLoading={true}
          message="Loading version..."
        />
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className="min-h-screen bg-background p-4">
        <InlineError
          message={error || 'Version not found'}
          variant="error"
          size="lg"
          className="mt-20 max-w-2xl mx-auto"
        />
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={handleGoToVersionsList}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Versions
          </Button>
        </div>
      </div>
    );
  }

  const parsedContent = parseContent(version.content);
  const isCurrentVersion = currentVersionIndex === 0;
  const isFirstVersion = !previousVersion;

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header with Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top row: Back button and page title */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToVersionsList}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              All Versions
            </Button>

            <button
              onClick={handleGoToPage}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[200px]"
            >
              {pageTitle}
            </button>

            <div className="w-24" /> {/* Spacer for alignment */}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToPrevious}
              disabled={!previousVersion}
              className="gap-1"
              title={previousVersion ? `Previous version (${formatRelativeTime(previousVersion.createdAt)})` : 'This is the first version'}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Older</span>
            </Button>

            {/* Center: Version info and position indicator */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span
                  className="font-medium cursor-help"
                  title={format(new Date(version.createdAt), 'PPpp')}
                >
                  {formatRelativeTime(version.createdAt)}
                </span>
                {isCurrentVersion && (
                  <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                    Current
                  </span>
                )}
                {isFirstVersion && (
                  <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                    First
                  </span>
                )}
              </div>

              {/* Version position indicator */}
              {allVersions.length > 1 && currentVersionIndex >= 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Version {allVersions.length - currentVersionIndex} of {allVersions.length}
                </div>
              )}
            </div>

            {/* Next / Skip to Current Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToNext}
                disabled={!nextVersion}
                className="gap-1"
                title={nextVersion ? `Next version (${formatRelativeTime(nextVersion.createdAt)})` : 'This is the most recent version'}
              >
                <span className="hidden sm:inline">Newer</span>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isCurrentVersion && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGoToCurrent}
                  className="gap-1"
                  title="Jump to current version"
                >
                  <SkipForward className="h-4 w-4" />
                  <span className="hidden sm:inline">Current</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pt-32 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Diff Stats Bar */}
          {version.diff && version.diff.hasChanges && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Changes from previous version:</span>
              </div>
              <DiffStats
                added={version.diff.added}
                removed={version.diff.removed}
                showTooltips={true}
                className="text-sm"
              />
            </div>
          )}

          {/* Diff Preview Summary */}
          {version.diffPreview && (version.diffPreview.hasAdditions || version.diffPreview.hasRemovals) && (
            <div className="mb-6 p-4 rounded-lg border border-border bg-card">
              <div className="text-xs text-muted-foreground mb-2">Change Summary</div>
              <div className="text-sm">
                {version.diffPreview.beforeContext && (
                  <span className="text-muted-foreground">...{version.diffPreview.beforeContext}</span>
                )}
                {version.diffPreview.hasRemovals && version.diffPreview.removedText && (
                  <span className="bg-red-500/20 text-red-600 dark:text-red-400 px-1 rounded line-through mx-0.5">
                    {version.diffPreview.removedText}
                  </span>
                )}
                {version.diffPreview.hasAdditions && version.diffPreview.addedText && (
                  <span className="bg-green-500/20 text-green-600 dark:text-green-400 px-1 rounded mx-0.5">
                    {version.diffPreview.addedText}
                  </span>
                )}
                {version.diffPreview.afterContext && (
                  <span className="text-muted-foreground">{version.diffPreview.afterContext}...</span>
                )}
              </div>
            </div>
          )}

          {/* Page Content Snapshot */}
          <div className="wewrite-card p-6">
            {version.title && (
              <h1 className="text-2xl font-bold mb-4 pb-4 border-b border-border">
                {version.title}
              </h1>
            )}

            {parsedContent ? (
              <PageProvider>
                <ViewableContent
                  content={parsedContent}
                  showLineNumbers={false}
                  className="prose prose-sm dark:prose-invert max-w-none"
                />
              </PageProvider>
            ) : (
              <div className="text-muted-foreground italic">
                No content available for this version
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd> / <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to go back
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
