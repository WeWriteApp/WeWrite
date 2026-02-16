"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { useOGImages, usePageLookup } from './hooks';
import {
  PageLookup,
  SocialMediaPreviews,
  ImageGallery,
  TechnicalDocs,
} from './components';

export default function OpenGraphImagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const {
    loadingImages,
    refreshKey,
    viewMode,
    setViewMode,
    handleRefreshAll,
    handleImageLoad,
    handleImageLoadStart,
    buildPreviewUrl,
  } = useOGImages();

  const {
    lookupPageId,
    setLookupPageId,
    lookupPageData,
    isLookingUp,
    handleLookupPage,
    handleClearLookup,
  } = usePageLookup();

  // Check if user is admin - use user.isAdmin from auth context for consistency
  React.useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/opengraph-images');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
        <div className="hidden lg:flex mb-6 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight">OpenGraph Images</h1>
            <p className="text-muted-foreground text-sm">
              Preview all OG image designs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2"
              >
                <Icon name="Grid" size={16} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
              >
                <Icon name="List" size={16} />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="gap-2"
            >
              <Icon name="RefreshCw" size={16} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="pt-24 lg:pt-0">
          <p className="text-muted-foreground mb-6">
            OpenGraph images used when WeWrite pages are shared on social media.
          </p>

          <PageLookup
            lookupPageId={lookupPageId}
            setLookupPageId={setLookupPageId}
            lookupPageData={lookupPageData}
            isLookingUp={isLookingUp}
            onLookup={handleLookupPage}
            onClear={handleClearLookup}
          />

          <SocialMediaPreviews
            lookupPageData={lookupPageData}
            refreshKey={refreshKey}
            buildPreviewUrl={buildPreviewUrl}
          />

          <ImageGallery
            viewMode={viewMode}
            refreshKey={refreshKey}
            loadingImages={loadingImages}
            buildPreviewUrl={buildPreviewUrl}
            onImageLoadStart={handleImageLoadStart}
            onImageLoad={handleImageLoad}
          />

          <TechnicalDocs />
        </div>
      </div>
    </div>
  );
}
