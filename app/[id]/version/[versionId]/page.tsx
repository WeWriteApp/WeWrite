"use client";

import React, { useEffect, useState, useContext, use } from 'react';
import { useRouter } from 'next/navigation';
import { getPageById, getPageVersionById, setCurrentVersion } from '../../../firebase/database';
import DashboardLayout from '../../../DashboardLayout';
import { Button } from '../../../components/ui/button';
import { ChevronLeft, ChevronRight, Clock, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader } from '../../../components/Loader';
import PageHeader from '../../../components/PageHeader.tsx';
import { AuthContext } from '../../../providers/AuthProvider';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import TextView from '../../../components/TextView';
import { toast } from 'sonner';
import { generateTextDiff } from '../../../utils/generateTextDiff';
import { generateDiffContent } from '../../../utils/diffUtils';
import { PageProvider, usePage } from '../../../contexts/PageContext';
import { LineSettingsProvider } from '../../../contexts/LineSettingsContext';

// Component to handle content parsing and rendering
function ContentRenderer({ page, version, diffContent, showDiff }: {
  page: any,
  version: any,
  diffContent: any,
  showDiff: boolean
}) {
  const { setPage } = usePage();
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Set the page data in the PageProvider when the component mounts
  useEffect(() => {
    if (page && setPage) {
      setPage(page);
    }
  }, [page, setPage]);

  // Parse the content safely
  useEffect(() => {
    if (!version?.content) {
      setParsedContent(null);
      return;
    }

    try {
      // Check if content is already an object
      if (typeof version.content === 'object') {
        setParsedContent(version.content);
      } else {
        // Parse the JSON string
        setParsedContent(JSON.parse(version.content));
      }
      setParseError(null);
    } catch (err) {
      console.error('Error parsing version content:', err);
      setParseError('Could not parse content for this version');
      setParsedContent(null);
    }
  }, [version]);

  if (parseError) {
    return (
      <div className="p-4 text-destructive border border-destructive/20 rounded-md bg-destructive/10">
        <p>{parseError}</p>
        <p className="text-sm mt-2">Raw content may not be in the expected format.</p>
      </div>
    );
  }

  if (!parsedContent) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader />
      </div>
    );
  }

  return (
    <TextView
      content={showDiff && diffContent ? diffContent : parsedContent}
      viewMode="normal"
      showDiff={showDiff}
    />
  );
}

// Wrapper component that ensures PageProvider is in place
function PageContentWrapper({ page, version, diffContent, showDiff }: {
  page: any,
  version: any,
  diffContent: any,
  showDiff: boolean
}) {
  return (
    <PageProvider initialPage={page}>
      <LineSettingsProvider>
        <ContentRenderer
          page={page}
          version={version}
          diffContent={diffContent}
          showDiff={showDiff}
        />
      </LineSettingsProvider>
    </PageProvider>
  );
}

export default function PageVersionView({ params }: { params: { id: string, versionId: string } }) {
  // Use React.use() to unwrap params
  const resolvedParams = use(params);
  const { id, versionId } = resolvedParams;
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
    if (version && currentVersion) {
      try {
        // Parse content with better error handling
        let versionContent;
        let currentContent;

        try {
          versionContent = typeof version.content === 'string'
            ? JSON.parse(version.content)
            : version.content;
        } catch (err) {
          console.error('Error parsing version content:', err);
          versionContent = [];
        }

        try {
          currentContent = typeof currentVersion.content === 'string'
            ? JSON.parse(currentVersion.content)
            : currentVersion.content;
        } catch (err) {
          console.error('Error parsing current version content:', err);
          currentContent = [];
        }

        // Ensure we have valid arrays for diff generation
        if (!Array.isArray(versionContent)) versionContent = [];
        if (!Array.isArray(currentContent)) currentContent = [];

        // Generate diff content with added/removed markers
        const diffResult = generateDiffContent(versionContent, currentContent);

        // Set the diff content
        setDiffContent(diffResult);

        // Automatically enable diff view when coming from history page
        if (document.referrer.includes('/history')) {
          setShowDiff(true);
        }
      } catch (err) {
        console.error('Error generating diff:', err);
        setDiffContent(null);
        setShowDiff(false);
      }
    }
  }, [version, currentVersion]);

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
        <Alert className="mb-4 bg-primary/10 border border-primary/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <AlertDescription className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold text-base">
                  You're viewing a previous version of this page
                </span>
                <span className="text-sm text-muted-foreground">
                  This version was created {version?.createdAt ? formatDistanceToNow(new Date(version.createdAt), { addSuffix: true }) : 'some time ago'}
                </span>
              </div>
            </AlertDescription>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToPage}
                className="bg-primary/10 hover:bg-primary/20 border-primary/20"
              >
                <Eye className="h-4 w-4 mr-1" />
                View Current
              </Button>
              <div className="flex items-center gap-1">
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
          </div>
        </Alert>

        {/* Diff toggle */}
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="diff-mode"
            checked={showDiff}
            onCheckedChange={setShowDiff}
            disabled={!currentVersion}
          />
          <Label htmlFor="diff-mode">Show changes from current version</Label>
        </div>

        {/* Content */}
        <div className="border rounded-lg p-4 mb-6 min-h-[300px] bg-card">
          {version ? (
            <PageContentWrapper
              page={page}
              version={version}
              diffContent={diffContent}
              showDiff={showDiff}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">No content available for this version</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBackToPage}
              className="bg-primary/10 hover:bg-primary/20 border-primary/20"
            >
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
