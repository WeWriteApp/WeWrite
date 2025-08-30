"use client";

import React, { useEffect, useState } from 'react';
import { calculateDiff, DiffResult } from '../../utils/diffService';
import TextView from './TextView';

interface DiffViewerProps {
  currentContent: string;
  previousContent: string;
  showLineNumbers?: boolean;
  highlightChanges?: boolean;
}

export default function DiffViewer({
  currentContent,
  previousContent,
  showLineNumbers = false,
  highlightChanges = true
}: DiffViewerProps) {
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateDiffContent();
  }, [currentContent, previousContent]);

  const calculateDiffContent = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Parse the content if it's JSON strings
      let parsedCurrent, parsedPrevious;
      
      try {
        parsedCurrent = typeof currentContent === 'string' ? JSON.parse(currentContent) : currentContent;
      } catch {
        parsedCurrent = currentContent;
      }

      try {
        parsedPrevious = typeof previousContent === 'string' ? JSON.parse(previousContent) : previousContent;
      } catch {
        parsedPrevious = previousContent;
      }

      const result = await calculateDiff(parsedCurrent, parsedPrevious);
      setDiffResult(result);

      // TODO: Consider using processDiffForDisplay here for better diff visualization
    } catch (error) {
      console.error('Error calculating diff:', error);
      setError('Failed to calculate diff');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-b-foreground"></div>
        <span className="ml-2 text-sm text-muted-foreground">Calculating differences...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600 dark:text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (!diffResult) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No diff data available</p>
      </div>
    );
  }

  // Parse content for display
  let displayContent;
  try {
    displayContent = typeof currentContent === 'string' ? JSON.parse(currentContent) : currentContent;
  } catch {
    displayContent = [{ type: "paragraph", children: [{ text: currentContent || "No content" }] }];
  }

  // If no changes, show the current content
  if (!diffResult.hasChanges) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          This is the initial version of the page.
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <TextView 
            content={displayContent} 
            showDiff={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Diff Stats */}
      <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Changes:</span>
          {diffResult.added > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">
              +{diffResult.added} added
            </span>
          )}
          {diffResult.removed > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              -{diffResult.removed} removed
            </span>
          )}
        </div>
      </div>

      {/* Diff Preview */}
      {diffResult.preview && (
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Summary of Changes</h4>
          <div className="text-sm">
            {/* Before context */}
            {diffResult.preview.beforeContext && (
              <span className="text-muted-foreground">
                ...{diffResult.preview.beforeContext}
              </span>
            )}

            {/* Removed text */}
            {diffResult.preview.hasRemovals && diffResult.preview.removedText && (
              <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded line-through mx-1">
                {diffResult.preview.removedText}
              </span>
            )}

            {/* Added text */}
            {diffResult.preview.hasAdditions && diffResult.preview.addedText && (
              <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1 rounded mx-1">
                {diffResult.preview.addedText}
              </span>
            )}

            {/* After context */}
            {diffResult.preview.afterContext && (
              <span className="text-muted-foreground">
                {diffResult.preview.afterContext}...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Full Content with Diff Highlighting */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Full Content</h4>
        <div className="border-theme-strong rounded-lg p-4 bg-card">
          <TextView 
            content={displayContent} 
            showDiff={highlightChanges}
          />
        </div>
      </div>

      {/* Previous Version for Comparison */}
      {previousContent && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Previous Version</h4>
          <div className="border-theme-strong rounded-lg p-4 bg-muted/20">
            <TextView 
              content={(() => {
                try {
                  return typeof previousContent === 'string' ? JSON.parse(previousContent) : previousContent;
                } catch {
                  return [{ type: "paragraph", children: [{ text: previousContent || "No previous content" }] }];
                }
              })()} 
              showDiff={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
