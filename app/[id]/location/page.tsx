'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    console.log('🗺️ LocationPicker: useEffect called with searchParams');

    // Get return path
    const returnParam = searchParams.get('return');
    console.log('🗺️ LocationPicker: returnParam:', returnParam);

    if (returnParam) {
      const decodedPath = decodeURIComponent(returnParam);
      setReturnPath(decodedPath);
      console.log('🗺️ LocationPicker: decodedPath:', decodedPath);

      // Extract page ID from return path
      const pathParts = decodedPath.split('/');
      const id = pathParts[pathParts.length - 1];
      console.log('🗺️ LocationPicker: extracted pageId:', id);
      setPageId(id);
    }

    // Get initial location data
    const dataParam = searchParams.get('data');
    console.log('🗺️ LocationPicker: dataParam:', dataParam);

    if (dataParam) {
      try {
        const locationData = JSON.parse(decodeURIComponent(dataParam));
        console.log('🗺️ LocationPicker: parsed location data:', locationData);
        setInitialLocation(locationData);
      } catch (error) {
        console.error('🗺️ LocationPicker: Error parsing location data:', error);
      }
    }
  }, [searchParams]);

  // Fetch page data to get title and ownership info
  useEffect(() => {
    async function fetchPageData() {
      console.log('🗺️ LocationPicker: useEffect triggered, pageId:', pageId);
      if (!pageId) {
        console.log('🗺️ LocationPicker: No pageId, setting loading to false');
        setLoading(false);
        return;
      }

      try {
        console.log('🗺️ LocationPicker: Fetching page data for:', pageId);
        const response = await fetch(`/api/pages/${pageId}?userId=dev_admin_user`);
        if (response.ok) {
          const pageData = await response.json();
          console.log('🗺️ LocationPicker: Page data received:', pageData);
          setPageTitle(pageData.title || 'Untitled');

          // Check if current user is the owner by checking if we can edit
          // For dev environment, assume dev_admin_user is always the owner
          const currentUser = await fetch('/api/auth/session');
          if (currentUser.ok) {
            const sessionData = await currentUser.json();
            console.log('🗺️ LocationPicker: Current user:', sessionData.user?.uid);
            console.log('🗺️ LocationPicker: Page owner:', pageData.userId);
            const isPageOwner = sessionData.user?.uid === pageData.userId;
            console.log('🗺️ LocationPicker: Is owner?', isPageOwner);
            setIsOwner(isPageOwner);
          } else {
            // In dev environment, if no session, assume dev_admin_user for pages owned by dev_admin_user
            console.log('🗺️ LocationPicker: No session, checking if dev page');
            const isDevPage = pageData.userId === 'dev_admin_user';
            console.log('🗺️ LocationPicker: Is dev page?', isDevPage);
            setIsOwner(isDevPage);
          }
        } else {
          console.error('🗺️ LocationPicker: Failed to fetch page data:', response.status);
        }
      } catch (error) {
        console.error('🗺️ LocationPicker: Error fetching page data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPageData();
  }, [pageId]);

  const handleSave = async (location: Location | null) => {
    console.log('🗺️ LocationPicker: handleSave called with:', location);
    console.log('🗺️ LocationPicker: pageId:', pageId);
    console.log('🗺️ LocationPicker: returnPath:', returnPath);

    if (!pageId) {
      console.error('🗺️ LocationPicker: No page ID available');
      router.push(returnPath);
      return;
    }

    try {
      console.log('🗺️ LocationPicker: Making API call to save location...');
      console.log('🗺️ LocationPicker: Location being sent:', {
        location,
        lat: location?.lat,
        lng: location?.lng,
        zoom: location?.zoom,
        latType: typeof location?.lat,
        lngType: typeof location?.lng,
        latValid: location?.lat >= -90 && location?.lat <= 90,
        lngValid: location?.lng >= -180 && location?.lng <= 180,
        requestBody: JSON.stringify({ location })
      });

      // Save location via API
      const response = await fetch(`/api/pages/${pageId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });

      console.log('🗺️ LocationPicker: API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🗺️ LocationPicker: API error:', errorData);
        throw new Error(errorData.error || 'Failed to update location');
      }

      const responseData = await response.json();
      console.log('🗺️ LocationPicker: Location saved successfully:', responseData);

      // Navigate back to the page and refresh to show updated location
      router.push(returnPath);
      // Force a refresh to reload the page data with the new location
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      console.error('🗺️ LocationPicker: Error saving location:', error);
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
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
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
