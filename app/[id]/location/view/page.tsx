'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import MapPicker from '../../../components/map/MapPicker';
import SubscriptionGate from '../../../components/subscription/SubscriptionGate';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

function LocationViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [location, setLocation] = useState<Location | null>(null);
  const [returnPath, setReturnPath] = useState<string>('/');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [pageId, setPageId] = useState<string>('');
  const [titleLoading, setTitleLoading] = useState<boolean>(true);

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

    // Get location data
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const locationData = JSON.parse(decodeURIComponent(dataParam));
        setLocation(locationData);
      } catch (error) {
        console.error('Error parsing location data:', error);
      }
    }
  }, [searchParams]);

  // Fetch page data to get title
  useEffect(() => {
    async function fetchPageData() {
      if (!pageId) {
        setTitleLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (response.ok) {
          const pageData = await response.json();
          setPageTitle(pageData.title || 'Untitled');
        }
      } catch (error) {
        console.error('Error fetching page data:', error);
      } finally {
        setTitleLoading(false);
      }
    }

    fetchPageData();
  }, [pageId]);

  const handleBack = () => {
    // Go to previous page - users can reach home via WeWrite logo
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback to return path if available
      if (returnPath) {
        router.push(returnPath);
      } else {
        window.history.back();
      }
    }
  };

  const formatCoordinates = (loc: Location) => {
    return `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
  };

  // Remove loading state - show map immediately

  if (!location) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No location data available</p>
          <Button onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-[9999] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="hover:bg-muted"
            >
              <Icon name="ArrowLeft" size={16} />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {titleLoading ? 'Page Location' : (pageTitle || 'Page Location')}
              </h1>
              <p className="text-sm text-muted-foreground">
                Page location
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <SubscriptionGate featureName="map" className="flex-1 relative" allowInteraction={true}>
        <MapPicker
          location={location}
          height="100%"
          readOnly={true} // Don't allow pin placement in view mode
          showControls={false} // Hide zoom controls to prevent overlap with header
          initialZoom={location?.zoom || 10} // Use saved zoom level, fallback to moderate zoom
          allowPanning={true} // Allow panning for exploration
        />
      </SubscriptionGate>

      {/* Footer with location info - removed coordinates display */}
    </div>
  );
}

export default function LocationView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <LocationViewContent />
    </Suspense>
  );
}
