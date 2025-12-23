'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import LocationPickerPage from '../../components/map/LocationPickerPage';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

function LocationPickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialLocation, setInitialLocation] = useState<Location | null>(null);
  const [returnPath, setReturnPath] = useState<string>('/');
  const [pageId, setPageId] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Get return path
    const returnParam = searchParams.get('return');

    if (returnParam) {
      const decodedPath = decodeURIComponent(returnParam);
      setReturnPath(decodedPath);

      // Extract page ID from return path
      const pathParts = decodedPath.split('/');
      const id = pathParts[pathParts.length - 1];
      setPageId(id);
    }

    // Get initial location data
    const dataParam = searchParams.get('data');

    if (dataParam) {
      try {
        const locationData = JSON.parse(decodeURIComponent(dataParam));
        setInitialLocation(locationData);
      } catch (error) {
        // Error parsing location data
      }
    }

    // Get canEdit param directly from URL
    const canEditParam = searchParams.get('canEdit');
    if (canEditParam === 'true') {
      setIsOwner(true);
    }

    // Get title param from URL
    const titleParam = searchParams.get('title');
    if (titleParam) {
      setPageTitle(decodeURIComponent(titleParam));
    }
  }, [searchParams]);

  // Fetch page data only if we don't have title from URL params
  // The canEdit and title params from URL are the source of truth - they come from
  // the component that knows about the current user's permissions
  useEffect(() => {
    async function fetchPageData() {
      if (!pageId) {
        setLoading(false);
        return;
      }

      // Only fetch if we don't already have the title from URL params
      const titleParam = searchParams.get('title');
      if (titleParam) {
        // We already have title and canEdit from URL params, no need to fetch
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/pages/${pageId}?userId=dev_admin_user`);
        if (response.ok) {
          const pageData = await response.json();
          // Only set title if we don't already have one from URL params
          if (!pageTitle) {
            setPageTitle(pageData.title || 'Untitled');
          }

          // Only check ownership if canEdit wasn't passed in URL
          const canEditParam = searchParams.get('canEdit');
          if (!canEditParam) {
            const currentUser = await fetch('/api/auth/session');
            if (currentUser.ok) {
              const sessionData = await currentUser.json();
              const isPageOwner = sessionData.user?.uid === pageData.userId;
              setIsOwner(isPageOwner);
            } else {
              const isDevPage = pageData.userId === 'dev_admin_user';
              setIsOwner(isDevPage);
            }
          }
        }
      } catch (error) {
        // Error fetching page data
      } finally {
        setLoading(false);
      }
    }

    fetchPageData();
  }, [pageId, searchParams, pageTitle]);

  const handleSave = async (location: Location | null) => {
    if (!pageId) {
      router.push(returnPath);
      return;
    }

    try {
      // Save location via API
      const response = await fetch(`/api/pages/${pageId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update location');
      }

      await response.json();

      // Navigate back to the page with the new location in URL params for immediate update
      // The page will read this and update state before the refresh completes
      const locationParam = location ? encodeURIComponent(JSON.stringify(location)) : '';
      const separator = returnPath.includes('?') ? '&' : '?';
      router.push(`${returnPath}${separator}updatedLocation=${locationParam}`);
      // Force a refresh to reload the page data with the new location
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      console.error('Failed to save location:', error);
      // Show error to user via alert (could be improved with toast)
      alert(error instanceof Error ? error.message : 'Failed to save location. Please try again.');
      // Do NOT navigate back on error - let user try again
    }
  };

  const handleCancel = () => {
    router.push(returnPath);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader" size={32} className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  const displayTitle = isOwner
    ? `Set Location - ${pageTitle}`
    : pageTitle;

  return (
    <LocationPickerPage
      initialLocation={initialLocation}
      onSave={handleSave}
      onCancel={handleCancel}
      pageTitle={displayTitle}
      isOwner={isOwner}
    />
  );
}

export default function LocationPicker() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <LocationPickerContent />
    </Suspense>
  );
}
