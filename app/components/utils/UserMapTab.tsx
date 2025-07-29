'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import MapPicker from '../map/MapPicker';
import { PillLink } from './PillLink';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

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
 * MultiLocationMap Component
 *
 * A map component that displays multiple markers for pages with locations.
 * Uses Leaflet to show all page locations on a single map.
 */
function MultiLocationMap({ pages, center, zoom, onPageClick }: MultiLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Initialize map
  useEffect(() => {
    async function initializeMap() {
      try {
        if (typeof window === 'undefined') return;

        // Dynamically import Leaflet
        if (!L) {
          const leaflet = await import('leaflet');
          L = leaflet.default;

          // Import CSS
          await import('leaflet/dist/leaflet.css');

          // Fix default markers
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          });
        }

        if (!mapRef.current || mapInstanceRef.current) return;

        // Create map
        const map = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true
        }).setView([center.lat, center.lng], zoom);

        // Add tile layer with theme support
        const tileUrl = resolvedTheme === 'dark'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
          attribution: resolvedTheme === 'dark'
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map');
        setIsLoading(false);
      }
    }

    initializeMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center.lat, center.lng, zoom, resolvedTheme]);

  // Add markers for all pages
  useEffect(() => {
    if (!mapInstanceRef.current || !L || pages.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add markers for each page
    pages.forEach(page => {
      const marker = L.marker([page.location.lat, page.location.lng])
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family: system-ui, -apple-system, sans-serif;">
            <div style="font-weight: 600; margin-bottom: 4px; color: ${resolvedTheme === 'dark' ? '#fff' : '#000'};">
              ${page.title}
            </div>
            <div style="font-size: 12px; color: ${resolvedTheme === 'dark' ? '#ccc' : '#666'}; margin-bottom: 8px;">
              ${page.location.lat.toFixed(4)}, ${page.location.lng.toFixed(4)}
            </div>
            <div style="font-size: 11px; color: ${resolvedTheme === 'dark' ? '#999' : '#888'};">
              Click marker to view page
            </div>
          </div>
        `)
        .on('click', () => {
          onPageClick(page);
        });

      markersRef.current.push(marker);
    });

    // Fit map to show all markers if there are multiple
    if (pages.length > 1) {
      const group = new L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [pages, onPageClick, resolvedTheme]);

  if (isLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="text-red-500 mb-2">Failed to load map</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-96" />;
}

/**
 * UserMapTab Component
 * 
 * Shows a map of all pages created by a user that have location data.
 * Displays markers for each page and allows clicking to navigate to the page.
 */
export default function UserMapTab({ userId, username }: UserMapTabProps) {
  const [pages, setPages] = useState<PageWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageWithLocation | null>(null);
  const router = useRouter();

  // Fetch pages with location data for this user
  useEffect(() => {
    async function fetchPagesWithLocation() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all pages for this user
        const response = await fetch(`/api/pages?userId=${encodeURIComponent(userId)}&limit=1000`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pages: ${response.status}`);
        }

        const data = await response.json();

        console.log('API Response:', data); // Debug log

        // Handle different API response formats
        let pages = [];
        if (data.success && data.pages) {
          pages = data.pages;
        } else if (Array.isArray(data)) {
          pages = data;
        } else if (data.pages && Array.isArray(data.pages)) {
          pages = data.pages;
        } else {
          console.warn('Unexpected API response format:', data);
          pages = [];
        }

        console.log('Pages array:', pages, 'Length:', pages.length); // Debug log
        console.log('Sample pages with location field:', pages.slice(0, 5).map(p => ({
          title: p.title,
          location: p.location,
          hasLocation: !!p.location
        }))); // Debug log

        // Filter pages that have location data
        const pagesWithLocation = pages
          .filter((page: any) => {
            // Check if page has location data - handle both string and object formats
            if (!page || !page.location) {
              console.log('Page without location:', page?.title, 'location:', page?.location); // Debug log
              return false;
            }

            // Handle object format ({lat, lng, zoom?}) - new format
            if (typeof page.location === 'object' && page.location.lat && page.location.lng) {
              const lat = Number(page.location.lat);
              const lng = Number(page.location.lng);
              const zoom = page.location.zoom ? Number(page.location.zoom) : undefined;
              const isValid = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
              const isZoomValid = zoom === undefined || (!isNaN(zoom) && zoom >= 1 && zoom <= 20);

              if (isValid && isZoomValid) {
                console.log('Found page with object location:', page.title, page.location); // Debug log
              }
              return isValid && isZoomValid;
            }

            // Handle string format ("lat,lng") - legacy format
            if (typeof page.location === 'string') {
              const [lat, lng] = page.location.split(',').map(Number);
              const isValid = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
              if (isValid) {
                console.log('Found page with string location:', page.title, page.location); // Debug log
              }
              return isValid;
            }

            return false;
          })
          .map((page: any) => {
            try {
              let lat, lng;

              // Handle object format
              if (typeof page.location === 'object') {
                lat = Number(page.location.lat);
                lng = Number(page.location.lng);
              }
              // Handle string format
              else if (typeof page.location === 'string') {
                [lat, lng] = page.location.split(',').map(Number);
              } else {
                throw new Error('Invalid location format');
              }

              return {
                id: page.id,
                title: page.title || 'Untitled',
                location: { lat, lng },
                isPublic: page.isPublic,
                lastModified: page.lastModified,
                username: page.username
              };
            } catch (error) {
              console.error('Error parsing page location:', page, error);
              return null;
            }
          })
          .filter(Boolean) // Remove any null entries from parsing errors
          .sort((a: PageWithLocation, b: PageWithLocation) =>
            new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
          );

        setPages(pagesWithLocation);
      } catch (err) {
        console.error('Error fetching pages with location:', err);
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
    if (pages.length === 0) {
      return { lat: 40.7128, lng: -74.0060 }; // Default to NYC
    }
    
    if (pages.length === 1) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading pages with locations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Error loading map data</div>
        <div className="text-sm text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No pages with locations</h3>
        <p className="text-muted-foreground mb-4">
          {username} hasn't added location data to any pages yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Pages can have locations added by clicking the map icon when editing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Map View */}
      <div className="relative">
        <div className="h-96 rounded-lg overflow-hidden border border-border">
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
      </div>

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
