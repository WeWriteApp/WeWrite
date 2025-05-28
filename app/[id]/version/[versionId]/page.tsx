"use client";

import React, { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { getPageById, getPageVersionById, setCurrentVersion } from '../../../firebase/database';
import DashboardLayout from '../../../DashboardLayout';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, ChevronRight, Clock, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader } from '../../../components/utils/Loader';
import PageHeader from '../../../components/pages/PageHeader';
import { AuthContext } from '../../../providers/AuthProvider';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import TextView from '../../../components/editor/TextView';
import TextViewErrorBoundary from '../../../components/editor/TextViewErrorBoundary';
import { toast } from '../../../components/ui/use-toast';
import { generateTextDiff } from '../../../utils/generateTextDiff';
import { generateDiffContent } from '../../../utils/diffUtils';

export default function PageVersionView({ params }: { params: { id: string, versionId: string } }) {
  const { id, versionId } = params;
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
  const { user } = useContext(AuthContext);
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
        setVersion(versionData);

        // Fetch current version for diff comparison
        if (pageResult.pageData.currentVersion) {
          const currentVersionData = await getPageVersionById(id, pageResult.pageData.currentVersion);
          setCurrentVersionData(currentVersionData);
        }

        // Fetch all versions to enable navigation between versions
        const { versions } = await getPageById(id, true);
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

        // First try to use the stored previousContent if available
        if (version.previousContent) {
          console.log('Using stored previousContent for diff generation');
          const previousContent = typeof version.previousContent === 'string'
            ? JSON.parse(version.previousContent)
            : version.previousContent;

          // Generate diff content with added/removed markers
          const diffResult = generateDiffContent(versionContent, previousContent);

          // Set the diff content
          setDiffContent(diffResult);
        }
        // Then try to use the previousVersion if available
        else if (version.previousVersion && version.previousVersion.content) {
          console.log('Using previousVersion content for diff generation');
          const previousContent = typeof version.previousVersion.content === 'string'
            ? JSON.parse(version.previousVersion.content)
            : version.previousVersion.content;

          // Generate diff content with added/removed markers
          const diffResult = generateDiffContent(versionContent, previousContent);

          // Set the diff content
          setDiffContent(diffResult);
        }
        // Finally fall back to the current version
        else if (currentVersion) {
          console.log('Using current version content for diff generation');
          const currentContent = typeof currentVersion.content === 'string'
            ? JSON.parse(currentVersion.content)
            : currentVersion.content;

          // Generate diff content with added/removed markers
          const diffResult = generateDiffContent(versionContent, currentContent);

          // Set the diff content
          setDiffContent(diffResult);
        }
        else {
          console.log('No previous content available for diff generation');
          setDiffContent(null);
          setShowDiff(false);
        }
      } catch (err) {
        console.error('Error generating diff:', err);
        setDiffContent(null);
        setShowDiff(false);
      }
    }
  }, [showDiff, version, currentVersion]);

  const handleBackToPage = () => {
    router.push(`/${id}`);
  };

  const handleBackToHistory = () => {
    router.push(`/${id}/history`);
  };

  const handleRevertToVersion = async () => {
    if (!isOwner || !version) return;

    try {
      const result = await setCurrentVersion(id, versionId);
      if (result) {
        toast.success('Page reverted to this version');
        router.push(`/${id}`);
      } else {
        toast.error('Failed to revert page');
      }
    } catch (err: any) {
      console.error('Error reverting page:', err);
      toast.error(err.message || 'Failed to revert page');
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
    router.push(`/${id}/version/${newVersionId}`);
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
          <PageHeader
            title="Error"
            backUrl={`/${id}`}
            backLabel="Back to page"
          />
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
        <div className="border rounded-lg p-4 mb-6">
          {version?.content ? (
            <TextViewErrorBoundary fallbackContent={
              <div className="p-4 text-muted-foreground">
                <p>Unable to display version content. The version may have formatting issues.</p>
                <p className="text-sm mt-2">Version ID: {params.versionId}</p>
              </div>
            }>
              <TextView
                content={showDiff && diffContent ? diffContent : JSON.parse(version.content)}
                viewMode="normal"
                showDiff={showDiff}
              />
            </TextViewErrorBoundary>
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
    </DashboardLayout>
  );
}
