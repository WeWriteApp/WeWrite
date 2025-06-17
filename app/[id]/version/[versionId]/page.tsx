"use client";

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getPageById, getPageVersionById, setCurrentVersion } from '../../../firebase/database';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, ChevronRight, Clock, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader } from '../../../components/utils/Loader';
import PageHeader from '../../../components/pages/PageHeader';
import { useAuth } from '../../../providers/AuthProvider';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import TextView from '../../../components/editor/TextView';
import TextViewErrorBoundary from '../../../components/editor/TextViewErrorBoundary.js';
import { useToast } from '../../../components/ui/use-toast';
import { generateTextDiff } from '../../../utils/generateTextDiff';
import { generateDiffContent } from '../../../utils/diffUtils';
import { PageProvider } from '../../../contexts/PageContext';
import { LineSettingsProvider } from '../../../contexts/LineSettingsContext';

export default function PageVersionView({ params }: { params: Promise<{ id: string, versionId: string }> | { id: string, versionId: string } }) {
  // Handle both Promise and object params
  // Note: use() hook cannot be called inside try/catch blocks
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof params.then === 'function') {
    unwrappedParams = use(params);
  } else {
    // If params is already an object, use it directly
    unwrappedParams = params || {};
  }

  const { id, versionId } = unwrappedParams;
  const [page, setPage] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [currentVersion, setCurrentVersionData] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<any>(null);
  const [versionIndex, setVersionIndex] = useState(-1);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user && page && user.uid === page.userId;

  useEffect(() => {
    async function fetchData() {
      if (!id || !versionId) {
        setError('Missing page or version ID');
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

        // Fetch the specific version
        const versionData = await getPageVersionById(id, versionId);
        if (!versionData) {
          setError('Version not found');
          setLoading(false);
          return;
        }

        // Debug logging for version data
        if (process.env.NODE_ENV === 'development') {
          console.log('Version viewer - fetched version data:', {
            versionId,
            hasContent: !!versionData.content,
            contentType: typeof versionData.content,
            contentLength: versionData.content?.length,
            contentPreview: versionData.content?.substring(0, 200),
            fullVersionData: versionData
          });
        }

        setVersion(versionData);

        // Fetch current version for diff comparison
        if (pageResult.pageData.currentVersion) {
          const currentVersionData = await getPageVersionById(id, pageResult.pageData.currentVersion);
          setCurrentVersionData(currentVersionData);
        }

        // Fetch all versions to enable navigation between versions
        const { versions } = await getPageById(id, null);
        if (versions && versions.length > 0) {
          setVersions(versions);
          // Find the index of the current version
          const index = versions.findIndex((v: any) => v.id === versionId);
          setVersionIndex(index);
        }
      } catch (err: any) {
        console.error('Error fetching version:', err);
        setError(err.message || 'Failed to load version');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, versionId]);

  // Generate diff content when showDiff changes or when version/currentVersion changes
  useEffect(() => {
    if (showDiff && version) {
      try {
        // Parse content
        const versionContent = typeof version.content === 'string'
          ? JSON.parse(version.content)
          : version.content;

        let previousContent = null;

        // First try to use the stored previousContent if available
        if (version.previousContent && version.previousContent !== '' && version.previousContent !== '[]') {
          console.log('Using stored previousContent for diff generation');
          previousContent = typeof version.previousContent === 'string'
            ? JSON.parse(version.previousContent)
            : version.previousContent;
        }
        // Then try to use the previousVersion if available
        else if (version.previousVersion && version.previousVersion.content) {
          console.log('Using previousVersion content for diff generation');
          previousContent = typeof version.previousVersion.content === 'string'
            ? JSON.parse(version.previousVersion.content)
            : version.previousVersion.content;
        }
        // Finally fall back to empty content for new pages
        else {
          console.log('No previous content available, treating as new page');
          previousContent = [];
        }

        // Generate diff content with added/removed markers
        const diffResult = generateDiffContent(versionContent, previousContent);
        console.log('Generated diff content:', diffResult);

        // Set the diff content
        setDiffContent(diffResult);
      } catch (err) {
        console.error('Error generating diff:', err);
        setDiffContent(null);
        setShowDiff(false);
      }
    } else {
      // Clear diff content when not showing diff
      setDiffContent(null);
    }
  }, [showDiff, version, currentVersion]);

  const handleBackToPage = () => {
    router.push('/' + id);
  };

  const handleBackToHistory = () => {
    router.push('/' + id + '/history');
  };

  const handleRevertToVersion = async () => {
    if (!isOwner || !version) return;

    try {
      const result = await setCurrentVersion(id, versionId);
      if (result) {
        toast({
          title: "Success",
          description: "Page reverted to this version",
        });
        router.push('/' + id);
      } else {
        toast({
          title: "Error",
          description: "Failed to revert page",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error('Error reverting page:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to revert page",
        variant: "destructive",
      });
    }
  };

  const navigateToVersion = (direction: 'next' | 'prev') => {
    if (versionIndex === -1 || !versions || versions.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = versionIndex + 1;
      if (newIndex >= versions.length) newIndex = 0; // Loop back to the beginning
    } else {
      newIndex = versionIndex - 1;
      if (newIndex < 0) newIndex = versions.length - 1; // Loop back to the end
    }

    const newVersionId = versions[newIndex].id;
    router.push('/' + id + '/version/' + newVersionId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader show={true} message="Loading..." id="version-loader">
          <div />
        </Loader>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <PageHeader
          title="Error"
        />
        <div className="text-destructive text-center p-8">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <PageHeader
          title={page?.title || "Untitled"}
          username={page?.username || "Anonymous"}
          userId={page?.userId}
          isLoading={loading}
        />

        {/* Version banner */}
        <Alert className="mb-4 bg-muted/50 border border-muted">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <AlertDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                You're looking at a past version of this page from{' '}
                <strong>
                  {version?.createdAt ? formatDistanceToNow(new Date(version.createdAt), { addSuffix: true }) : 'some time ago'}
                </strong>
              </span>
            </AlertDescription>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToVersion('prev')}
                disabled={versions.length <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToVersion('next')}
                disabled={versions.length <= 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Alert>

        {/* Diff toggle */}
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="diff-mode"
            checked={showDiff}
            onCheckedChange={setShowDiff}
            disabled={!version || (!version.previousContent && !version.previousVersion && !currentVersion)}
          />
          <Label htmlFor="diff-mode">Show changes from previous version</Label>
        </div>

        {/* Content */}
        <div className="border-theme-strong rounded-lg p-4 mb-6">
          {version?.content ? (
            <PageProvider>
              <LineSettingsProvider>
                <TextViewErrorBoundary fallbackContent={
                  <div className="p-4 text-muted-foreground">
                    <p>Unable to display version content. The version may have formatting issues.</p>
                    <p className="text-sm mt-2">Version ID: {versionId}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">Debug Info</summary>
                      <pre className="text-xs mt-2 p-2 bg-muted rounded">
                        {JSON.stringify({
                          hasContent: !!version?.content,
                          contentType: typeof version?.content,
                          contentLength: version?.content?.length,
                          contentPreview: version?.content?.substring(0, 100)
                        }, null, 2)}
                      </pre>
                    </details>
                  </div>
                }>
                  <TextView
                    content={(() => {
                      try {
                        if (showDiff && diffContent) {
                          console.log('Version viewer - showing diff content:', diffContent);
                          return diffContent;
                        }

                        // Parse the version content
                        console.log('Version viewer - parsing content:', {
                          contentType: typeof version.content,
                          contentLength: version.content?.length,
                          rawContent: version.content
                        });

                        const parsedContent = typeof version.content === 'string'
                          ? JSON.parse(version.content)
                          : version.content;

                        console.log('Version viewer - parsed content:', parsedContent);

                        // Ensure it's an array
                        if (!Array.isArray(parsedContent)) {
                          console.warn('Version content is not an array:', parsedContent);
                          return [{ type: "paragraph", children: [{ text: "Content format error" }] }];
                        }

                        // If empty array, show placeholder
                        if (parsedContent.length === 0) {
                          console.log('Version viewer - empty content array');
                          return [{ type: "paragraph", children: [{ text: "This version has no content" }] }];
                        }

                        return parsedContent;
                      } catch (parseError) {
                        console.error('Error parsing version content:', parseError, version.content);
                        return [{ type: "paragraph", children: [{ text: `Error parsing content: ${parseError.message}` }] }];
                      }
                    })()}
                    viewMode="normal"
                    showDiff={showDiff}
                  />
                </TextViewErrorBoundary>
              </LineSettingsProvider>
            </PageProvider>
          ) : (
            <p className="text-muted-foreground text-center py-8">No content available for this version</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBackToPage}>
              <Eye className="h-4 w-4 mr-2" />
              View current version
            </Button>
            <Button variant="outline" onClick={handleBackToHistory}>
              <Clock className="h-4 w-4 mr-2" />
              View all history
            </Button>
          </div>

          {isOwner && (
            <Button
              variant="default"
              onClick={handleRevertToVersion}
              className="ml-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Revert to this version
            </Button>
          )}
        </div>
    </div>
  );
}
