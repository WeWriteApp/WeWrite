'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LocationPickerPage from '../../components/map/LocationPickerPage';

interface Location {
  lat: number;
  lng: number;
}

function LocationPickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialLocation, setInitialLocation] = useState<Location | null>(null);
  const [returnPath, setReturnPath] = useState<string>('/');
  const [pageId, setPageId] = useState<string>('');

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

      // Navigate back to the page
      router.push(returnPath);
    } catch (error) {
      console.error('🗺️ LocationPicker: Error saving location:', error);
      // Still navigate back even if save failed
      router.push(returnPath);
    }
  };

  const handleCancel = () => {
    router.push(returnPath);
  };

  return (
    <LocationPickerPage
      initialLocation={initialLocation}
      onSave={handleSave}
      onCancel={handleCancel}
      pageTitle="Set Location"
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
