'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '../components/ui/drawer';
import { AdaptiveModal } from '../components/ui/adaptive-modal';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Button } from '../components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createTileLayer, getDefaultMapView } from '../utils/mapConfig';
import PillLink from '../components/utils/PillLink';
import { useCommandPalette } from '../providers/CommandPaletteProvider';
import { UsernameBadge } from '../components/ui/UsernameBadge';
import { EmbeddedAllocationBar } from '../components/payments/EmbeddedAllocationBar';
import { cn } from '../lib/utils';

// Import Leaflet CSS dynamically on client side only
if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
}

// Leaflet imports - we'll import these dynamically to avoid SSR issues
let L: any = null;

interface MapPage {
  id: string;
  title: string;
  location: {
    lat: number;
    lng: number;
    zoom?: number;
  };
  username: string;
  userId: string;
  lastModified: string;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const PAGE_LIMIT = 50;

// CSS for marker styling and tooltip labels
const mapMarkerCSS = `
  @keyframes marker-pulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.4); }
  }
  .active-marker .leaflet-marker-icon {
    filter: hue-rotate(120deg) saturate(1.5);
    animation: marker-pulse 1.5s ease-in-out infinite;
    z-index: 1000 !important;
  }
  .map-page-label-tooltip {
    background: white !important;
    border: 1px solid #e5e5e5 !important;
    border-radius: 4px !important;
    padding: 2px 6px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    white-space: nowrap !important;
    max-width: 120px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
    color: #333 !important;
  }
  .map-page-label-tooltip::before {
    border-bottom-color: #e5e5e5 !important;
  }
  .dark .map-page-label-tooltip {
    background: #1f1f1f !important;
    border-color: #333 !important;
    color: #e5e5e5 !important;
  }
  .dark .map-page-label-tooltip::before {
    border-bottom-color: #333 !important;
  }
  .map-page-label-tooltip.active-tooltip {
    background: hsl(142.1 76.2% 36.3%) !important;
    color: white !important;
    border-color: hsl(142.1 76.2% 36.3%) !important;
    font-weight: 600 !important;
  }
  .map-page-label-tooltip.active-tooltip::before {
    border-bottom-color: hsl(142.1 76.2% 36.3%) !important;
  }
`;

function MapPageContent() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openPaletteWithLocationLink } = useCommandPalette();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const labelsRef = useRef<Map<string, any>>(new Map());
  const mapInitializedRef = useRef(false);
  const lastFetchBoundsRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<MapPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const firstFetchDoneRef = useRef(false);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Track if selection came from list click (to avoid scroll-into-view loop)
  const selectionFromListRef = useRef(false);

  // New pin placement state
  const [newPinLocation, setNewPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showNewPinDrawer, setShowNewPinDrawer] = useState(false);
  const newPinMarkerRef = useRef<any>(null);

  // Share button state
  const [shareSuccess, setShareSuccess] = useState(false);

  // Filter state - persisted in localStorage
  const [hideInactive, setHideInactive] = useState(true);
  const [hideUnverified, setHideUnverified] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Load filter preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('map-filter-prefs');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (typeof prefs.hideInactive === 'boolean') setHideInactive(prefs.hideInactive);
        if (typeof prefs.hideUnverified === 'boolean') setHideUnverified(prefs.hideUnverified);
      }
    } catch {}
  }, []);

  // Save filter preferences to localStorage
  const updateFilterPref = useCallback((key: 'hideInactive' | 'hideUnverified', value: boolean) => {
    if (key === 'hideInactive') setHideInactive(value);
    else setHideUnverified(value);
    try {
      const saved = localStorage.getItem('map-filter-prefs');
      const prefs = saved ? JSON.parse(saved) : {};
      prefs[key] = value;
      localStorage.setItem('map-filter-prefs', JSON.stringify(prefs));
    } catch {}
  }, []);

  // Parse initial viewport from URL params (for shared links)
  const initialViewport = React.useMemo(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const zoom = searchParams.get('zoom');
    if (lat && lng && zoom) {
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        zoom: parseInt(zoom, 10)
      };
    }
    return null;
  }, [searchParams]);

  const selectedPage = selectedIndex >= 0 && selectedIndex < pages.length ? pages[selectedIndex] : null;

  // Fetch pages with location data (works for both logged-in and logged-out users)
  const fetchMapPages = useCallback(async (bounds?: MapBounds) => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/map-pages?global=true&limit=${PAGE_LIMIT}`;
      url += `&hideInactive=${hideInactive}&hideUnverified=${hideUnverified}`;
      if (bounds) {
        url += `&bounds=${encodeURIComponent(JSON.stringify(bounds))}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch map pages');
      }

      const data = await response.json();
      if (data.success) {
        setPages(data.pages || []);
        // Auto-select first page if available (only if not already selected)
        if (data.pages?.length > 0) {
          setSelectedIndex(prev => prev < 0 ? 0 : prev);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch pages');
      }
    } catch (err) {
      console.error('Error fetching map pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load map pages');
    } finally {
      setLoading(false);
      firstFetchDoneRef.current = true;
    }
  }, [hideInactive, hideUnverified]);

  // Refetch when filters change
  useEffect(() => {
    fetchMapPages();
  }, [fetchMapPages]);

  // Mark initial load complete once map is ready and first fetch is done, with a buffer for tiles
  useEffect(() => {
    if (!mapReady || !firstFetchDoneRef.current || initialLoadComplete) return;
    const timer = setTimeout(() => setInitialLoadComplete(true), 300);
    return () => clearTimeout(timer);
  }, [mapReady, loading, initialLoadComplete]);

  // Inject CSS for bouncing animation and labels
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'map-marker-animations';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = mapMarkerCSS;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Prevent body scrolling on map page
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Initialize map
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !mapRef.current || mapInitializedRef.current) {
        return;
      }

      try {
        const leaflet = await import('leaflet');
        L = leaflet.default;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        });

        const isDarkMode = resolvedTheme === 'dark';
        const tileLayer = createTileLayer(L, isDarkMode);
        tileLayer.addTo(map);

        if (initialViewport) {
          map.setView([initialViewport.lat, initialViewport.lng], initialViewport.zoom);
        } else {
          const defaultView = getDefaultMapView(undefined);
          map.setView(defaultView.center, 2);
        }

        let moveTimeout: NodeJS.Timeout;
        map.on('moveend', () => {
          clearTimeout(moveTimeout);
          moveTimeout = setTimeout(() => {
            const bounds = map.getBounds();
            const newBounds: MapBounds = {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest()
            };
            setCurrentBounds(newBounds);
          }, 500);
        });

        // Handle map click to add new pin
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;

          if (newPinMarkerRef.current) {
            map.removeLayer(newPinMarkerRef.current);
          }

          const greenIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const newMarker = L.marker([lat, lng], { icon: greenIcon });
          newMarker.addTo(map);
          newPinMarkerRef.current = newMarker;

          setNewPinLocation({ lat, lng });
          setShowNewPinDrawer(true);
        });

        mapInstanceRef.current = map;
        mapInitializedRef.current = true;
        setMapReady(true);
      } catch (err) {
        console.error('Failed to initialize map:', err);
        setError('Failed to initialize map. Please refresh the page.');
      }
    };

    const timer = setTimeout(initializeMap, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        labelsRef.current.clear();
        newPinMarkerRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, [resolvedTheme, initialViewport]);

  // Update markers when pages change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;

    const map = mapInstanceRef.current;

    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current.clear();
    labelsRef.current.forEach(label => map.removeLayer(label));
    labelsRef.current.clear();

    pages.forEach((page, index) => {
      const marker = L.marker([page.location.lat, page.location.lng]);

      marker.on('click', () => {
        selectionFromListRef.current = false;
        setSelectedIndex(index);
      });

      marker.addTo(map);
      markersRef.current.set(page.id, marker);

      const truncatedTitle = page.title.length > 15 ? page.title.substring(0, 15) + '...' : page.title;
      marker.bindTooltip(truncatedTitle, {
        permanent: true,
        direction: 'bottom',
        offset: [0, 10],
        className: 'map-page-label-tooltip'
      });
      labelsRef.current.set(page.id, marker);
    });

    if (pages.length > 0) {
      const currentZoom = map.getZoom();
      if (currentZoom <= 3) {
        const bounds = L.latLngBounds(pages.map(p => [p.location.lat, p.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [pages, mapReady]);

  // Animate active marker and scroll list item into view when selection changes
  useEffect(() => {
    if (!mapReady || !L || !selectedPage) return;

    const map = mapInstanceRef.current;
    if (!map) return;

    // Reset all markers and tooltip labels
    markersRef.current.forEach((marker) => {
      const element = marker.getElement();
      if (element) {
        element.classList.remove('active-marker');
      }
      const tooltip = marker.getTooltip();
      if (tooltip) {
        const tooltipElement = tooltip.getElement();
        if (tooltipElement) {
          tooltipElement.classList.remove('active-tooltip');
        }
      }
    });

    // Highlight the selected marker
    const activeMarker = markersRef.current.get(selectedPage.id);
    if (activeMarker) {
      const element = activeMarker.getElement();
      if (element) {
        element.classList.add('active-marker');
      }
      const tooltip = activeMarker.getTooltip();
      if (tooltip) {
        const tooltipElement = tooltip.getElement();
        if (tooltipElement) {
          tooltipElement.classList.add('active-tooltip');
        }
      }

      // Pan map to marker (unless selection came from the list center button)
      if (!selectionFromListRef.current) {
        map.panTo([selectedPage.location.lat, selectedPage.location.lng], {
          animate: true,
          duration: 0.3
        });
      }
    }

    // Scroll list item into view when marker is clicked on the map
    if (listRef.current && selectedIndex >= 0 && !selectionFromListRef.current) {
      const item = listRef.current.querySelector(`[data-list-index="${selectedIndex}"]`);
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    selectionFromListRef.current = false;
  }, [selectedIndex, selectedPage, mapReady]);

  // Refetch when bounds change significantly
  useEffect(() => {
    if (currentBounds && mapInstanceRef.current && !loading) {
      const zoom = mapInstanceRef.current.getZoom();
      if (zoom > 5) {
        const boundsKey = `${currentBounds.north.toFixed(2)},${currentBounds.south.toFixed(2)},${currentBounds.east.toFixed(2)},${currentBounds.west.toFixed(2)}`;
        if (boundsKey !== lastFetchBoundsRef.current) {
          lastFetchBoundsRef.current = boundsKey;
          fetchMapPages(currentBounds);
        }
      }
    }
  }, [currentBounds, fetchMapPages, loading]);

  // Center map on a specific page location (triggered from list)
  const centerOnPage = useCallback((index: number) => {
    const page = pages[index];
    if (!page || !mapInstanceRef.current) return;

    selectionFromListRef.current = true;
    setSelectedIndex(index);

    mapInstanceRef.current.panTo([page.location.lat, page.location.lng], {
      animate: true,
      duration: 0.3
    });
  }, [pages]);

  // Cancel new pin placement
  const cancelNewPin = useCallback(() => {
    if (newPinMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(newPinMarkerRef.current);
      newPinMarkerRef.current = null;
    }
    setNewPinLocation(null);
    setShowNewPinDrawer(false);
  }, []);

  // Handle create new page at location
  const handleCreateNewPage = useCallback(() => {
    if (!newPinLocation) return;
    const locationData = encodeURIComponent(JSON.stringify({
      lat: newPinLocation.lat,
      lng: newPinLocation.lng,
      zoom: mapInstanceRef.current?.getZoom() || 15
    }));
    router.push(`/new?location=${locationData}`);
  }, [newPinLocation, router]);

  // Handle link existing page to location
  const handleLinkExistingPage = useCallback(() => {
    if (!newPinLocation) return;
    openPaletteWithLocationLink({
      lat: newPinLocation.lat,
      lng: newPinLocation.lng,
      zoom: mapInstanceRef.current?.getZoom() || 15,
    });
  }, [newPinLocation, openPaletteWithLocationLink]);

  // Share current map viewport
  const handleShare = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const shareUrl = `${window.location.origin}/map?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&zoom=${zoom}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'WeWrite Map',
          text: 'Check out this location on WeWrite',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (err) {
      // User cancelled share or error
    }
  }, []);

  // Invalidate map size when layout changes (needed for Leaflet in flex containers)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [mapReady]);

  // ── List item component ──
  const LocationListItem = ({ page, index }: { page: MapPage; index: number }) => {
    const isActive = index === selectedIndex;
    return (
      <div
        data-list-index={index}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
          isActive
            ? "bg-primary/5"
            : "hover:bg-muted/50"
        )}
        onClick={() => router.push(`/${page.id}`)}
      >
        {/* Center-on-map button */}
        <button
          className={cn(
            "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border transition-colors",
            isActive
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-transparent text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30"
          )}
          onClick={(e) => {
            e.stopPropagation();
            centerOnPage(index);
          }}
          aria-label={`Center map on ${page.title}`}
          title="Center on map"
        >
          <Icon name="Crosshair" size={15} />
        </button>

        {/* Page info — title and author inline */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <PillLink
            href={`/${page.id}`}
            pageId={page.id}
            onClick={(e) => e.stopPropagation()}
          >
            {page.title}
          </PillLink>
          <span className="text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            by{' '}
            <UsernameBadge
              userId={page.userId}
              username={page.username}
              size="sm"
              variant="link"
              showBadge={false}
            />
          </span>
        </div>

        {/* Navigate arrow */}
        <Icon name="ChevronRight" size={14} className="flex-shrink-0 text-muted-foreground/60" />
      </div>
    );
  };

  return (
    <NavPageLayout maxWidth="full" className="!p-0 !pb-0 !pt-0 !min-h-0 overflow-hidden">
      {/* Loading Overlay */}
      <div
        className="fixed sidebar-inset bg-background flex items-center justify-center z-50 transition-opacity duration-500"
        style={{
          opacity: initialLoadComplete ? 0 : 1,
          pointerEvents: initialLoadComplete ? 'none' : 'auto',
        }}
      >
        <div className="text-center space-y-2">
          <Icon name="Loader" className="mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>

      {/* ── Main Layout ── */}
      {/* Mobile: vertical stack (map top, list bottom) */}
      {/* Desktop: horizontal (sidebar left, map right) */}
      <div className="fixed sidebar-inset flex flex-col md:flex-row overflow-hidden">

        {/* ── Sidebar / List Panel ── */}
        <div className="order-2 md:order-1 flex-1 md:flex-none md:w-80 lg:w-96 flex flex-col border-t md:border-t-0 md:border-r border-border bg-background overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background">
            <div className="flex items-center gap-2">
              <Icon name="MapPin" size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">
                {pages.length} {pages.length === 1 ? 'location' : 'locations'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border transition-colors",
                  (!hideInactive || !hideUnverified)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
                aria-label="Map filters"
              >
                <Icon name="SlidersHorizontal" size={15} />
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Share map view"
              >
                {shareSuccess ? (
                  <Icon name="Check" size={15} className="text-green-600" />
                ) : (
                  <Icon name="Share2" size={15} />
                )}
              </button>
            </div>
          </div>

          {/* Scrollable list */}
          <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-border/40">
            {pages.length > 0 ? (
              pages.map((page, index) => (
                <LocationListItem key={page.id} page={page} index={index} />
              ))
            ) : (
              !loading && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Icon name="MapPin" size={32} className="text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">No pages with locations</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap the map to add a page
                  </p>
                </div>
              )
            )}

            {/* Loading state in list */}
            {loading && pages.length === 0 && (
              <div className="flex items-center justify-center p-8">
                <Icon name="Loader" className="text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* ── Map Panel ── */}
        <div className="order-1 md:order-2 h-[45vh] md:h-full flex-shrink-0 md:flex-1 relative">
          {/* Error State */}
          {error && (
            <div className="absolute top-3 left-3 right-3 z-10">
              <div className="wewrite-card p-3 flex items-center gap-3 bg-destructive/10 border-destructive/30">
                <Icon name="AlertCircle" size={20} className="text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive flex-1">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchMapPages()}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Map */}
          <div
            ref={mapRef}
            className="absolute inset-0 bg-muted"
            style={{ zIndex: 1 }}
          />

          {/* Top hint text */}
          {mapReady && !showNewPinDrawer && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-background/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 shadow-lg">
                <p className="text-xs text-muted-foreground">Tap map to add a page</p>
              </div>
            </div>
          )}

          {/* Loading indicator for refetch */}
          {loading && mapReady && (
            <div className="absolute top-3 right-3 z-10">
              <div className="wewrite-card p-2">
                <Icon name="Loader" className="text-primary" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <AdaptiveModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Map Filters"
        subtitle="Customize which pins appear on the map"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="map-hide-inactive" className="text-sm font-medium">
                Hide inactive subscribers
              </Label>
              <p className="text-xs text-muted-foreground">
                Only show pins from users with active subscriptions
              </p>
            </div>
            <Switch
              id="map-hide-inactive"
              checked={hideInactive}
              onCheckedChange={(checked) => updateFilterPref('hideInactive', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="map-hide-unverified" className="text-sm font-medium">
                Hide unverified users
              </Label>
              <p className="text-xs text-muted-foreground">
                Only show pins from users with verified emails
              </p>
            </div>
            <Switch
              id="map-hide-unverified"
              checked={hideUnverified}
              onCheckedChange={(checked) => updateFilterPref('hideUnverified', checked)}
            />
          </div>
        </div>
      </AdaptiveModal>

      {/* New Pin Drawer */}
      <Drawer open={showNewPinDrawer && !!newPinLocation} onOpenChange={(open) => !open && cancelNewPin()}>
        <DrawerContent height="auto" noOverlay>
          <DrawerHeader className="border-b-0 pb-2">
            <DrawerTitle className="text-center w-full">Add page here?</DrawerTitle>
          </DrawerHeader>
          <DrawerFooter className="flex-col gap-2 pb-8">
            <Button
              onClick={handleCreateNewPage}
              className="w-full justify-start gap-3"
            >
              <Icon name="Plus" size={20} />
              Create new page
            </Button>
            <Button
              variant="secondary"
              onClick={handleLinkExistingPage}
              className="w-full justify-start gap-3"
            >
              <Icon name="Link2" size={20} />
              Link existing page
            </Button>
            <Button
              variant="ghost"
              onClick={cancelNewPin}
              className="w-full justify-start gap-3 text-muted-foreground"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </NavPageLayout>
  );
}

// Wrap the main component in Suspense to handle useSearchParams
export default function MapPage() {
  return (
    <Suspense fallback={
      <NavPageLayout maxWidth="full" className="!p-0 !pb-0 !pt-0 !min-h-0 overflow-hidden">
        <div className="fixed sidebar-inset bg-background flex items-center justify-center">
          <div className="text-center space-y-2">
            <Icon name="Loader" className="mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </NavPageLayout>
    }>
      <MapPageContent />
    </Suspense>
  );
}
