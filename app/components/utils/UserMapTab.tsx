'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import EmptyState from '../ui/EmptyState';
import { PillLink } from './PillLink';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createTileLayer, getDefaultMapView, logMapError } from '../../utils/mapConfig';
import SubscriptionGate from '../subscription/SubscriptionGate';

// Import Leaflet CSS dynamically on client side only
if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
}

interface Location {
  lat: number;
  lng: number;
}

interface PageWithLocation {
  id: string;
  title: string;
  location: Location;
  isPublic: boolean;
  lastModified: string;
  username?: string;
}

interface UserMapTabProps {
  userId: string;
  username: string;
  isOwnContent?: boolean;
}

interface MultiLocationMapProps {
  pages: PageWithLocation[];
  center: Location;
  zoom: number;
  onPageClick: (page: PageWithLocation) => void;
}

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

/**
 * SimpleMap Component
 *
 * A simplified map component for testing
 */
function SimpleMap({ pages }: { pages: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('initializing');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      try {
        setStatus('loading leaflet');

        // Dynamic import
        const leaflet = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!mounted) return;

        setStatus('creating map');

        // Fix default markers
        delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
        leaflet.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        if (!mapRef.current || !mounted) return;

        const map = leaflet.default.map(mapRef.current, {
          attributionControl: false
        }).setView([40.7128, -74.0060], 2);

        // Use centralized tile layer configuration for consistency
        const isDarkMode = resolvedTheme === 'dark';
        const tileLayer = createTileLayer(leaflet.default, isDarkMode);
        tileLayer.addTo(map);

        // Add markers
        pages.forEach(page => {
          if (page.location?.lat && page.location?.lng) {
            leaflet.default.marker([page.location.lat, page.location.lng])
              .addTo(map);
          }
        });

        setStatus('ready');
      } catch (err) {
        console.error('Simple map error:', err);
        setStatus(`error: ${err.message}`);
      }
    }

    initMap();

    return () => {
      mounted = false;
    };
  }, [pages]);

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Status: {status}</div>
      <div
        ref={setMapContainer}
        style={{ height: '200px', width: '100%' }}
        className="border border-border rounded"
      />
    </div>
  );
}

/**
 * MultiLocationMap Component
 *
 * A simplified map component that displays multiple markers for pages with locations.
 * Uses the same approach as SimpleMap but with more features.
 */
function MultiLocationMap({ pages, center, zoom, onPageClick }: MultiLocationMapProps) {
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      try {
        if (!mapContainer || mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
          setTimeout(() => {
            if (mounted) initMap();
          }, 50);
          return;
        }

        setStatus('loading leaflet');
        console.log('🗺️ MultiLocationMap: Step 1 - Loading Leaflet...');

        // Dynamic import with explicit error handling
        let leaflet;
        try {
          console.log('🗺️ MultiLocationMap: About to import leaflet...');
          leaflet = await import('leaflet');
          console.log('🗺️ MultiLocationMap: Leaflet imported successfully:', !!leaflet);
        } catch (importError) {
          console.error('🗺️ MultiLocationMap: Failed to import leaflet:', importError);
          setStatus('error: failed to load leaflet');
          return;
        }
        console.log('🗺️ MultiLocationMap: Step 1.1 - Leaflet imported successfully');

        await import('leaflet/dist/leaflet.css');
        console.log('🗺️ MultiLocationMap: Step 1.2 - Leaflet CSS imported successfully');

        if (!mounted) {
          console.log('🗺️ MultiLocationMap: Component unmounted during import, aborting');
          return;
        }

        setStatus('creating map');
        console.log('🗺️ MultiLocationMap: Step 2 - Setting up Leaflet icons...');

        // Fix default markers
        delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
        leaflet.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
        console.log('🗺️ MultiLocationMap: Step 2.1 - Icons configured successfully');

        // Double-check the map container is still available and properly attached
        if (!mapContainer) {
          console.error('🗺️ MultiLocationMap: ERROR - Map container became unavailable');
          setStatus('error: container lost');
          return;
        }

        // Verify the DOM element is actually in the document
        if (!document.contains(mapContainer)) {
          console.error('🗺️ MultiLocationMap: ERROR - Map container not in document');
          setStatus('error: container not in DOM');
          return;
        }

        if (!mounted) {
          console.log('🗺️ MultiLocationMap: Component unmounted before map creation, aborting');
          return;
        }

        console.log('🗺️ MultiLocationMap: Step 3 - Creating map instance...');
        console.log('🗺️ MultiLocationMap: Map container dimensions:', {
          width: mapContainer.offsetWidth,
          height: mapContainer.offsetHeight,
          clientWidth: mapContainer.clientWidth,
          clientHeight: mapContainer.clientHeight
        });

        // Create map with provided center and zoom
        console.log('🗺️ MultiLocationMap: Creating map with center:', [center.lat, center.lng], 'zoom:', zoom);
        const map = leaflet.default.map(mapContainer, {
          attributionControl: false // Remove attribution control
        }).setView([center.lat, center.lng], zoom);

        // Add tile layer using centralized configuration for consistency
        const isDarkMode = resolvedTheme === 'dark';
        const tileLayer = createTileLayer(leaflet.default, isDarkMode);
        tileLayer.addTo(map);

        // Style zoom controls for dark theme compatibility
        setTimeout(() => {
          const zoomControls = mapContainer.querySelectorAll('.leaflet-control-zoom a');
          zoomControls.forEach(control => {
            if (isDarkMode) {
              control.style.backgroundColor = 'hsl(var(--background))';
              control.style.color = 'hsl(var(--foreground))';
              control.style.borderColor = 'hsl(var(--border))';
            }
          });
        }, 100);

        // Add markers for pages
        pages.forEach((page, index) => {
          if (page.location?.lat && page.location?.lng) {
            const marker = leaflet.default.marker([page.location.lat, page.location.lng])
              .on('click', () => {
                onPageClick(page);
              })
              .addTo(map);
          }
        });

        // Fit map to show all markers if there are multiple
        if (pages.length > 1) {
          const validPages = pages.filter(p => p.location?.lat && p.location?.lng);
          if (validPages.length > 0) {
            const group = new leaflet.default.featureGroup(
              validPages.map(page =>
                leaflet.default.marker([page.location!.lat, page.location!.lng])
              )
            );
            map.fitBounds(group.getBounds().pad(0.1));
          }
        }

        mapInstanceRef.current = map;
        setStatus('ready');
      } catch (err) {
        console.error('🗺️ MultiLocationMap: === INITIALIZATION FAILED ===');
        console.error('🗺️ MultiLocationMap: Error details:', {
          message: err?.message || 'Unknown error',
          stack: err?.stack,
          name: err?.name,
          cause: err?.cause,
          mapContainerExists: !!mapContainer,
          mapContainerInDOM: mapContainer ? document.contains(mapContainer) : false
        });
        console.error('🗺️ MultiLocationMap: Full error object:', err);
        setStatus(`error: ${err?.message || 'Unknown error'}`);
        // Don't set error state to avoid breaking the component completely
        console.log('🗺️ MultiLocationMap: Component will continue to function despite map initialization failure');
      }
    }

    console.log('🗺️ MultiLocationMap: useEffect triggered');
    console.log('🗺️ MultiLocationMap: Checking prerequisites:', {
      hasPages: pages.length > 0,
      hasMapContainer: !!mapContainer
    });

    // Only initialize if we have pages and a map container
    if (pages.length > 0 && mapContainer) {
      console.log('🗺️ MultiLocationMap: Prerequisites met, calling initMap()');
      // Add a small delay to ensure DOM is fully rendered after tab switch
      setTimeout(() => {
        if (mounted) {
          initMap();
        }
      }, 100);
    } else {
      console.log('🗺️ MultiLocationMap: Prerequisites not met:', {
        hasPages: pages.length > 0,
        hasMapContainer: !!mapContainer
      });
    }

    return () => {
      console.log('🗺️ MultiLocationMap: Cleanup function called');
      mounted = false;
      if (mapInstanceRef.current) {
        console.log('🗺️ MultiLocationMap: Removing existing map instance');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pages, center.lat, center.lng, zoom, resolvedTheme, onPageClick, mapContainer]);

  // Always render the map container, but show loading overlay when needed
  const isLoading = status === 'initializing' || status === 'loading leaflet' || status === 'creating map';

  if (error || status.startsWith('error:')) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-center p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load map</div>
          <div className="text-sm text-red-500 dark:text-red-500 mb-4">{error || status}</div>
          <div className="text-xs text-muted-foreground">
            {pages.length} pages with locations available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={setMapContainer}
        className="w-full"
        style={{
          height: '384px',
          minHeight: '384px',
          width: '100%'
        }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading map... ({status})</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UserMapTab Component
 * 
 * Shows a map of all pages created by a user that have location data.
 * Displays markers for each page and allows clicking to navigate to the page.
 */
export default function UserMapTab({ userId, username, isOwnContent = false }: UserMapTabProps) {

  const [pages, setPages] = useState<PageWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageWithLocation | null>(null);

  const router = useRouter();

  // Fetch pages with location data for this user
  useEffect(() => {
    console.log('🗺️ UserMapTab useEffect triggered for userId:', userId);

    async function fetchPagesWithLocation() {
      try {
        console.log('🗺️ UserMapTab: Starting to fetch pages for user:', userId);
        setLoading(true);
        setError(null);

        // Fetch pages with location data for this user using optimized endpoint
        const apiUrl = `/api/map-pages?userId=${encodeURIComponent(userId)}`;
        console.log('🗺️ Making API call to optimized map endpoint:', apiUrl);
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pages: ${response.status}`);
        }

        const data = await response.json();

        console.log('🗺️ UserMapTab: === API RESPONSE RECEIVED ===');
        console.log('🗺️ UserMapTab: Response details:', {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url
        });
        console.log('🗺️ UserMapTab: Response data:', {
          data: data,
          dataType: typeof data,
          dataKeys: data ? Object.keys(data) : 'null',
          dataStringified: JSON.stringify(data, null, 2)
        });

        // Handle API response - the new endpoint only returns pages with valid location data
        let pages = [];
        if (data.success && data.pages) {
          pages = data.pages;
          console.log('🗺️ UserMapTab: Successfully extracted pages from API response');
        } else {
          console.warn('🗺️ UserMapTab: === UNEXPECTED API RESPONSE FORMAT ===');
          console.warn('🗺️ UserMapTab: Expected format: { success: true, pages: [...] }');
          console.warn('🗺️ UserMapTab: Actual format:', data);
          pages = [];
        }

        console.log('🗺️ UserMapTab: === PROCESSING PAGES ===');
        console.log('🗺️ UserMapTab: Raw pages from API:', {
          totalPages: pages.length,
          allPages: pages.map((p, i) => ({
            index: i,
            id: p.id,
            title: p.title,
            location: p.location,
            locationValid: !!(p.location?.lat && p.location?.lng),
            username: p.username
          }))
        });

        // Convert to PageWithLocation format (no filtering needed since endpoint pre-filters)
        const pagesWithLocation = pages.map((page: any, index: number) => {
          console.log(`🗺️ UserMapTab: Processing page ${index + 1}:`, {
            id: page.id,
            title: page.title,
            location: page.location,
            hasValidLocation: !!(page.location?.lat && page.location?.lng)
          });

          return {
            id: page.id,
            title: page.title,
            location: page.location, // Already validated by the API
            isPublic: true, // All pages are accessible since we're querying by userId
            lastModified: page.lastModified,
            username: page.username
          };
        });

        console.log('🗺️ UserMapTab: === FINAL PAGES TO SET ===');
        console.log('🗺️ UserMapTab: About to setPages with:', {
          pagesWithLocationCount: pagesWithLocation.length,
          allPagesWithLocation: pagesWithLocation.map((p, i) => ({
            index: i,
            id: p.id,
            title: p.title,
            location: p.location,
            locationValid: !!(p.location?.lat && p.location?.lng)
          }))
        });

        console.log('🗺️ UserMapTab: === CALLING setPages ===');
        setPages(pagesWithLocation);
        console.log('🗺️ UserMapTab: setPages called successfully, React should re-render component');
      } catch (err) {
        console.error('🗺️ Error fetching pages with location:', {
          error: err,
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
          userId: userId
        });
        setError(err instanceof Error ? err.message : 'Failed to load pages');
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchPagesWithLocation();
    }
  }, [userId]);

  // Calculate center point for map view
  const mapCenter = React.useMemo(() => {
    console.log('🗺️ UserMapTab: === CALCULATING MAP CENTER ===');
    console.log('🗺️ UserMapTab: Current pages state:', {
      pagesLength: pages.length,
      pages: pages.map(p => ({
        title: p.title,
        location: p.location
      }))
    });

    if (pages.length === 0) {
      console.log('🗺️ UserMapTab: No pages, using default view');
      const defaultView = getDefaultMapView();
      const center = { lat: defaultView.center[0], lng: defaultView.center[1] };
      console.log('🗺️ UserMapTab: Default center:', center);
      return center;
    }

    if (pages.length === 1) {
      console.log('🗺️ UserMapTab: Single page, using its location as center');
      return pages[0].location;
    }

    // Calculate center of all locations
    const avgLat = pages.reduce((sum, page) => sum + page.location.lat, 0) / pages.length;
    const avgLng = pages.reduce((sum, page) => sum + page.location.lng, 0) / pages.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [pages]);

  // Calculate appropriate zoom level based on spread of locations
  const mapZoom = React.useMemo(() => {
    if (pages.length <= 1) {
      return 10;
    }

    // Calculate bounding box
    const lats = pages.map(p => p.location.lat);
    const lngs = pages.map(p => p.location.lng);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);

    // Determine zoom level based on spread
    if (maxSpread > 50) return 2;
    if (maxSpread > 20) return 4;
    if (maxSpread > 10) return 5;
    if (maxSpread > 5) return 6;
    if (maxSpread > 2) return 7;
    if (maxSpread > 1) return 8;
    if (maxSpread > 0.5) return 9;
    return 10;
  }, [pages]);

  console.log('🗺️ CRITICAL: UserMapTab render state:', {
    loading,
    error,
    pagesLength: pages.length,
    username,
    mapCenter,
    mapZoom,
    samplePages: pages.slice(0, 2).map(p => ({ id: p.id, title: p.title, location: p.location }))
  });

  if (loading) {
    console.log('🗺️ CRITICAL: Showing loading state');
    return (
      <div className="flex items-center justify-center py-12 min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading pages with locations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('🗺️ CRITICAL: Showing error state:', error);
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Error loading map data</div>
        <div className="text-sm text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (pages.length === 0) {
    console.log('🗺️ CRITICAL: Showing no pages state');
    return (
      <EmptyState
        icon={MapPin}
        title="No pages with locations"
        description={`${username} hasn't added location data to any pages yet. Pages can have locations added by clicking the map icon when editing.`}
        size="lg"
      />
    );
  }

  console.log('🗺️ CRITICAL: About to render MultiLocationMap with pages:', pages.length);
  console.log('🗺️ CRITICAL: Map center:', mapCenter);
  console.log('🗺️ CRITICAL: Map zoom:', mapZoom);

  return (
    <div className="space-y-6">


      {/* Map View */}
      <SubscriptionGate featureName="map" className="relative" isOwnContent={isOwnContent} allowInteraction={true}>
        <div
          className="rounded-lg overflow-hidden border border-border"
          style={{
            height: '384px',
            minHeight: '384px',
            width: '100%'
          }}
        >
          <MultiLocationMap
            pages={pages}
            center={mapCenter}
            zoom={mapZoom}
            onPageClick={(page) => router.push(`/${page.id}`)}
          />
        </div>

        {/* Map overlay with page count */}
        <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{pages.length}</span>
            <span className="text-muted-foreground">
              {pages.length === 1 ? 'page' : 'pages'} with locations
            </span>
          </div>
        </div>
      </SubscriptionGate>

      {/* Pages List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Pages with Locations</h3>
        <div className="space-y-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <PillLink
                    href={`/${page.id}`}
                    variant="primary"
                    isPublic={page.isPublic}
                    className="max-w-full"
                  >
                    {page.title}
                  </PillLink>
                  <div className="text-xs text-muted-foreground mt-1">
                    {page.location.lat.toFixed(4)}, {page.location.lng.toFixed(4)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/${page.id}/location/view`)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
