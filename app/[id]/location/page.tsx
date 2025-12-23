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
  }, [searchParams]);

  // Fetch page data to get title and ownership info
  useEffect(() => {
    async function fetchPageData() {
      if (!pageId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/pages/${pageId}?userId=dev_admin_user`);
        if (response.ok) {
          const pageData = await response.json();
          setPageTitle(pageData.title || 'Untitled');

          // Check if current user is the owner by checking if we can edit
          // For dev environment, assume dev_admin_user is always the owner
          const currentUser = await fetch('/api/auth/session');
          if (currentUser.ok) {
            const sessionData = await currentUser.json();
            const isPageOwner = sessionData.user?.uid === pageData.userId;
            setIsOwner(isPageOwner);
          } else {
            // In dev environment, if no session, assume dev_admin_user for pages owned by dev_admin_user
            const isDevPage = pageData.userId === 'dev_admin_user';
            setIsOwner(isDevPage);
          }
        }
      } catch (error) {
        // Error fetching page data
      } finally {
        setLoading(false);
      }
    }

    fetchPageData();
  }, [pageId]);

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

      // Navigate back to the page and refresh to show updated location
      router.push(returnPath);
      // Force a refresh to reload the page data with the new location
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      // Still navigate back even if save failed
      router.push(returnPath);
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
