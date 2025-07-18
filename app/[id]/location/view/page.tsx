'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import OpenStreetMapPicker from '../../../components/map/OpenStreetMapPicker';

interface Location {
  lat: number;
  lng: number;
}

function LocationViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [location, setLocation] = useState<Location | null>(null);
  const [returnPath, setReturnPath] = useState<string>('/');

  useEffect(() => {
    // Get return path
    const returnParam = searchParams.get('return');
    if (returnParam) {
      setReturnPath(decodeURIComponent(returnParam));
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Location View</h1>
              <p className="text-sm text-muted-foreground">
                {formatCoordinates(location)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <OpenStreetMapPicker
          location={location}
          height="100%"
          readOnly={true}
          showControls={false}
          initialZoom={15}
        />
      </div>

      {/* Footer with location info */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {formatCoordinates(location)}
          </span>
        </div>
      </div>
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
