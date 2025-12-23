"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import ContentPageHeader from './ContentPageHeader';
import UnifiedLoader from '../ui/unified-loader';
import { ErrorDisplay } from '../ui/error-display';
import { formatDistanceToNow } from 'date-fns';
import { sanitizeUsername } from '../../utils/usernameSecurity';

// Helper function to extract text from structured content
const extractTextFromContent = (content: any): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(extractTextFromContent).join('\n');
  }

  if (content && typeof content === 'object') {
    if (content.type === 'paragraph' && content.children) {
      return content.children.map(child => {
        if (typeof child === 'string') return child;
        if (child.text) return child.text;
        if (child.type === 'link' && child.children) {
          return child.children.map(c => c.text || '').join('');
        }
        return '';
      }).join('');
    }

    if (content.type === 'link' && content.children) {
      return content.children.map(child => child.text || '').join('');
    }

    if (content.text) {
      return content.text;
    }
  }

  return '';
};

// Component to render structured content properly
const WeWriteDiffView = ({ currentContent, previousContent, showDiff = false }) => {
  // Parse content if it's a string (JSON)
  let parsedCurrent = currentContent;
  let parsedPrevious = previousContent;

  try {
    if (typeof currentContent === 'string' && currentContent.startsWith('[')) {
      parsedCurrent = JSON.parse(currentContent);
    }
  } catch (e) {
    // If parsing fails, use as string
  }

  try {
    if (typeof previousContent === 'string' && previousContent.startsWith('[')) {
      parsedPrevious = JSON.parse(previousContent);
    }
  } catch (e) {
    // If parsing fails, use as string
  }

  // Extract plain text for comparison
  const currentText = extractTextFromContent(parsedCurrent);
  const previousText = extractTextFromContent(parsedPrevious);

  if (!showDiff || !previousText || !currentText) {
    // Just show the content normally
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <div className="whitespace-pre-wrap">
          {currentText}
        </div>
      </div>
    );
  }

  // Simple character-by-character diff on the extracted text
  const current = currentText || '';
  const previous = previousText || '';

  // Find the common prefix and suffix
  let prefixEnd = 0;
  while (prefixEnd < Math.min(current.length, previous.length) &&
         current[prefixEnd] === previous[prefixEnd]) {
    prefixEnd++;
  }

  let suffixStart = current.length;
  let prevSuffixStart = previous.length;
  while (suffixStart > prefixEnd && prevSuffixStart > prefixEnd &&
         current[suffixStart - 1] === previous[prevSuffixStart - 1]) {
    suffixStart--;
    prevSuffixStart--;
  }

  const prefix = current.substring(0, prefixEnd);
  const added = current.substring(prefixEnd, suffixStart);
  const removed = previous.substring(prefixEnd, prevSuffixStart);
  const suffix = current.substring(suffixStart);

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <div className="whitespace-pre-wrap">
        {prefix}
        {removed && (
          <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 line-through">
            {removed}
          </span>
        )}
        {added && (
          <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
            {added}
          </span>
        )}
        {suffix}
      </div>
    </div>
  );
};

interface Version {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  username: string;
  title: string;
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

interface VersionDetailViewProps {
  pageId: string;
  versionId: string;
}

export default function VersionDetailView({ pageId, versionId }: VersionDetailViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [previousVersion, setPreviousVersion] = useState<Version | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    loadVersions();
  }, [pageId, versionId]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Loading versions for pageId:', pageId, 'versionId:', versionId);

      // Fetch all versions for the page
      const response = await fetch(`/api/pages/${pageId}/versions?limit=50&includeNoOp=false`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const allVersions = result.data?.versions || result.versions || [];
        console.log('Fetched versions:', allVersions.length);

        setVersions(allVersions);

        // Find the current version and its index
        const index = allVersions.findIndex((v: Version) => v.id === versionId);
        if (index !== -1) {
          const current = allVersions[index];
          const previous = index < allVersions.length - 1 ? allVersions[index + 1] : null;

          setCurrentVersion(current);
          setPreviousVersion(previous);
          setCurrentIndex(index);
          console.log('Found current version:', current.id, 'at index:', index);
          console.log('Previous version:', previous?.id || 'none');
        } else {
          setError('Version not found');
        }
      } else {
        setError('Failed to load versions');
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      setError('Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToVersion = (targetVersionId: string) => {
    router.push(`/${pageId}/version/${targetVersionId}`);
  };

  const goToOlder = () => {
    if (currentIndex < versions.length - 1) {
      const olderVersionId = versions[currentIndex + 1].id;
      navigateToVersion(olderVersionId);
    }
  };

  const goToNewer = () => {
    if (currentIndex > 0) {
      const newerVersionId = versions[currentIndex - 1].id;
      navigateToVersion(newerVersionId);
    }
  };

  const goBackToVersions = () => {
    router.push(`/${pageId}/versions`);
  };

  const goToCurrentVersion = () => {
    router.push(`/${pageId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 max-w-4xl mx-auto">
          <UnifiedLoader message="Loading version details..." isLoading={true} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 max-w-4xl mx-auto">
          <ErrorDisplay message={error} />
        </div>
      </div>
    );
  }

  if (!currentVersion) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 max-w-4xl mx-auto">
          <ErrorDisplay message="Version not found" />
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        relative: formatDistanceToNow(date, { addSuffix: true }),
        absolute: date.toLocaleString()
      };
    } catch (error) {
      return {
        relative: 'Unknown time',
        absolute: timestamp
      };
    }
  };

  const timeInfo = formatTimestamp(currentVersion.createdAt);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-2 sm:p-4 max-w-4xl mx-auto">
            {/* Header */}
            <ContentPageHeader
              title={`${currentVersion.title} - Version History`}
              username={currentVersion.username}
              isLoading={false}
            />

            {/* Version Navigation - Mobile Optimized */}
            <div className="mb-4 sm:mb-6 bg-muted/50 rounded-lg p-3 sm:p-4">
              {/* Mobile: Stack vertically */}
              <div className="flex flex-col gap-3 sm:hidden">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goBackToVersions}
                    className="flex items-center justify-center gap-2 flex-1"
                  >
                    <Icon name="ArrowLeft" size={16} />
                    Back to Versions
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={goToCurrentVersion}
                    className="flex items-center justify-center gap-2 flex-1"
                  >
                    Current Version
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  Version {currentIndex + 1} of {versions.length}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goToOlder}
                    disabled={currentIndex >= versions.length - 1}
                    className="flex items-center justify-center gap-2 flex-1"
                  >
                    <Icon name="ChevronLeft" size={16} />
                    Older
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goToNewer}
                    disabled={currentIndex <= 0}
                    className="flex items-center justify-center gap-2 flex-1"
                  >
                    Newer
                    <Icon name="ChevronRight" size={16} />
                  </Button>
                </div>
              </div>

              {/* Desktop: Horizontal layout */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goBackToVersions}
                    className="flex items-center gap-2"
                  >
                    <Icon name="ArrowLeft" size={16} />
                    Back to Versions
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={goToCurrentVersion}
                    className="flex items-center gap-2"
                  >
                    Current Version
                  </Button>

                  <div className="text-sm text-muted-foreground">
                    Version {currentIndex + 1} of {versions.length}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goToOlder}
                    disabled={currentIndex >= versions.length - 1}
                    className="flex items-center gap-2"
                  >
                    <Icon name="ChevronLeft" size={16} />
                    Older
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goToNewer}
                    disabled={currentIndex <= 0}
                    className="flex items-center gap-2"
                  >
                    Newer
                    <Icon name="ChevronRight" size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Version Info - Mobile Optimized */}
            <div className="mb-4 sm:mb-6 bg-card rounded-lg border-theme-strong p-3 sm:p-4">
              {/* Mobile: Stack vertically */}
              <div className="sm:hidden">
                <h2 className="text-lg font-semibold mb-2 break-words">{currentVersion.title}</h2>
                <div className="text-sm text-muted-foreground mb-2">
                  by {sanitizeUsername(currentVersion.username)}
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {timeInfo.relative}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {timeInfo.absolute}
                </div>
                {currentVersion.diff && currentVersion.diff.hasChanges && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {currentVersion.diff.added > 0 && (
                      <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                        +{currentVersion.diff.added} added
                      </span>
                    )}
                    {currentVersion.diff.removed > 0 && (
                      <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                        -{currentVersion.diff.removed} removed
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop: Horizontal layout */}
              <div className="hidden sm:block">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{currentVersion.title}</h2>
                  <div className="text-sm text-muted-foreground">
                    by {sanitizeUsername(currentVersion.username)}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground mb-2">
                  {timeInfo.relative} ({timeInfo.absolute})
                </div>

                {currentVersion.diff && currentVersion.diff.hasChanges && (
                  <div className="flex items-center gap-4 text-sm">
                    {currentVersion.diff.added > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        +{currentVersion.diff.added} added
                      </span>
                    )}
                    {currentVersion.diff.removed > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        -{currentVersion.diff.removed} removed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Changes from previous version - Mobile Optimized */}
            {previousVersion ? (
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-lg font-semibold px-1">Changes from previous version</h3>

                {/* New Version with Diff Highlighting */}
                <div className="bg-card rounded-lg border-theme-strong">
                  <div className="p-3 sm:p-4 border-b-only">
                    <h4 className="font-medium text-green-600 dark:text-green-400 text-sm sm:text-base">
                      New Version (with changes highlighted)
                    </h4>
                  </div>
                  <div className="p-3 sm:p-4 overflow-x-auto">
                    <WeWriteDiffView
                      currentContent={currentVersion.content}
                      previousContent={previousVersion.content}
                      showDiff={true}
                    />
                  </div>
                </div>

                {/* Previous Version */}
                <div className="bg-card rounded-lg border-theme-strong">
                  <div className="p-3 sm:p-4 border-b-only">
                    <h4 className="font-medium text-muted-foreground text-sm sm:text-base">Previous Version</h4>
                  </div>
                  <div className="p-3 sm:p-4 overflow-x-auto">
                    <WeWriteDiffView
                      currentContent={previousVersion.content}
                      previousContent=""
                      showDiff={false}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border-theme-strong">
                <div className="p-3 sm:p-4 border-b-only">
                  <h3 className="font-medium text-sm sm:text-base">Initial version</h3>
                </div>
                <div className="p-3 sm:p-4 overflow-x-auto">
                  <WeWriteDiffView
                    currentContent={currentVersion.content}
                    previousContent=""
                    showDiff={false}
                  />
                </div>
              </div>
            )}
      </div>
    </div>
  );
}
