'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { MapPin, Loader2, AlertCircle, ChevronLeft, ChevronRight, Plus, Link2, Share2, Check } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '../components/ui/drawer';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Button } from '../components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createTileLayer, getDefaultMapView } from '../utils/mapConfig';
import PillLink from '../components/utils/PillLink';
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

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const labelsRef = useRef<Map<string, any>>(new Map());
  const mapInitializedRef = useRef(false);
  const lastFetchBoundsRef = useRef<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<MapPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Touch handling for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Track if selection change came from scroll (to avoid scroll loop)
  const isScrollingRef = useRef(false);

  // New pin placement state
  const [newPinLocation, setNewPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showNewPinDrawer, setShowNewPinDrawer] = useState(false);
  const newPinMarkerRef = useRef<any>(null);

  // Share button state
  const [shareSuccess, setShareSuccess] = useState(false);

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
    }
  }, []); // Works for both logged-in and logged-out users

  // Initial fetch - works for all users
  useEffect(() => {
    fetchMapPages();
  }, [fetchMapPages]);

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
    if (typeof document !== 'undefined') {
      // Save original styles
      const originalOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      // Disable scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        // Restore original styles on unmount
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, []);

  // Initialize map
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || !mapRef.current || mapInitializedRef.current) {
        return;
      }

      try {
        // Dynamic import to avoid SSR issues
        const leaflet = await import('leaflet');
        L = leaflet.default;

        // Fix for default markers in webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Create map instance - no zoom controls for cleaner UI
        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        });

        // Add tile layer with theme support
        const isDarkMode = resolvedTheme === 'dark';
        const tileLayer = createTileLayer(L, isDarkMode);
        tileLayer.addTo(map);

        // Set initial view - use URL params if available, otherwise world view
        if (initialViewport) {
          map.setView([initialViewport.lat, initialViewport.lng], initialViewport.zoom);
        } else {
          const defaultView = getDefaultMapView(null);
          map.setView(defaultView.center, 2);
        }

        // Handle map move/zoom - debounced
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

          // Remove existing new pin marker if any
          if (newPinMarkerRef.current) {
            map.removeLayer(newPinMarkerRef.current);
          }

          // Create a green marker icon for the new pin
          const greenIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          // Add the new pin marker
          const newMarker = L.marker([lat, lng], { icon: greenIcon });
          newMarker.addTo(map);
          newPinMarkerRef.current = newMarker;

          // Store the location and show the drawer
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

    // Clear existing markers and labels
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current.clear();
    labelsRef.current.forEach(label => map.removeLayer(label));
    labelsRef.current.clear();

    // Add markers and labels for each page
    pages.forEach((page, index) => {
      // Create marker
      const marker = L.marker([page.location.lat, page.location.lng]);

      marker.on('click', () => {
        setSelectedIndex(index);
      });

      marker.addTo(map);
      markersRef.current.set(page.id, marker);

      // Attach a tooltip to the marker that appears below it
      const truncatedTitle = page.title.length > 15 ? page.title.substring(0, 15) + '...' : page.title;
      marker.bindTooltip(truncatedTitle, {
        permanent: true,
        direction: 'bottom',
        offset: [0, 10],
        className: 'map-page-label-tooltip'
      });
      labelsRef.current.set(page.id, marker); // Store reference to marker for label styling
    });

    // If we have pages and map is at world view, fit to markers
    if (pages.length > 0) {
      const currentZoom = map.getZoom();

      // Only auto-fit if at world view (zoom level 2-3)
      if (currentZoom <= 3) {
        const bounds = L.latLngBounds(pages.map(p => [p.location.lat, p.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [pages, mapReady]);

  // Animate active marker and update label when selection changes
  useEffect(() => {
    if (!mapReady || !L || !selectedPage) return;

    const map = mapInstanceRef.current;
    if (!map) return;

    // Reset all markers and tooltip labels
    markersRef.current.forEach((marker, id) => {
      const element = marker.getElement();
      if (element) {
        element.classList.remove('active-marker');
      }
      // Reset tooltip styling
      const tooltip = marker.getTooltip();
      if (tooltip) {
        const tooltipElement = tooltip.getElement();
        if (tooltipElement) {
          tooltipElement.classList.remove('active-tooltip');
        }
      }
    });

    // Highlight the selected marker (pulsing effect via CSS)
    const activeMarker = markersRef.current.get(selectedPage.id);
    if (activeMarker) {
      const element = activeMarker.getElement();
      if (element) {
        element.classList.add('active-marker');
      }

      // Highlight the tooltip
      const tooltip = activeMarker.getTooltip();
      if (tooltip) {
        const tooltipElement = tooltip.getElement();
        if (tooltipElement) {
          tooltipElement.classList.add('active-tooltip');
        }
      }

      // Always pan to marker when selection changes
      map.panTo([selectedPage.location.lat, selectedPage.location.lng], {
        animate: true,
        duration: 0.3
      });
    }

    // Scroll carousel to the selected card (only if not triggered by scroll)
    if (carouselRef.current && selectedIndex >= 0 && !isScrollingRef.current) {
      const cards = carouselRef.current.querySelectorAll('[data-card-index]');
      const targetCard = cards[selectedIndex] as HTMLElement;
      if (targetCard) {
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
    isScrollingRef.current = false;
  }, [selectedIndex, selectedPage, mapReady]);

  // Handle carousel scroll to detect which card is centered
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || pages.length === 0) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Debounce scroll detection
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const cards = carousel.querySelectorAll('[data-card-index]');
        if (cards.length === 0) return;

        const carouselRect = carousel.getBoundingClientRect();
        const carouselCenter = carouselRect.left + carouselRect.width / 2;

        let closestIndex = 0;
        let closestDistance = Infinity;

        cards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(cardCenter - carouselCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        // Only update if the index changed
        if (closestIndex !== selectedIndex) {
          isScrollingRef.current = true;
          setSelectedIndex(closestIndex);
        }
      }, 100);
    };

    carousel.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(scrollTimeout);
      carousel.removeEventListener('scroll', handleScroll);
    };
  }, [pages.length, selectedIndex]);

  // Refetch when bounds change significantly
  useEffect(() => {
    if (currentBounds && mapInstanceRef.current && !loading) {
      const zoom = mapInstanceRef.current.getZoom();
      // Only refetch when zoomed in enough (zoom > 5)
      if (zoom > 5) {
        // Create a bounds key to prevent duplicate fetches
        const boundsKey = `${currentBounds.north.toFixed(2)},${currentBounds.south.toFixed(2)},${currentBounds.east.toFixed(2)},${currentBounds.west.toFixed(2)}`;
        if (boundsKey !== lastFetchBoundsRef.current) {
          lastFetchBoundsRef.current = boundsKey;
          fetchMapPages(currentBounds);
        }
      }
    }
  }, [currentBounds, fetchMapPages, loading]);

  // Navigation functions
  const navigateToPrevious = useCallback(() => {
    if (pages.length === 0) return;
    setSelectedIndex(prev => (prev <= 0 ? pages.length - 1 : prev - 1));
  }, [pages.length]);

  const navigateToNext = useCallback(() => {
    if (pages.length === 0) return;
    setSelectedIndex(prev => (prev >= pages.length - 1 ? 0 : prev + 1));
  }, [pages.length]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      navigateToNext();
    } else if (isRightSwipe) {
      navigateToPrevious();
    }
  };

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
    // Navigate to new page with location data
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
    // Navigate to search with location context
    const locationData = encodeURIComponent(JSON.stringify({
      lat: newPinLocation.lat,
      lng: newPinLocation.lng,
      zoom: mapInstanceRef.current?.getZoom() || 15
    }));
    router.push(`/search?linkLocation=${locationData}`);
  }, [newPinLocation, router]);

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
      console.log('Share cancelled or failed:', err);
    }
  }, []);

  return (
    <NavPageLayout maxWidth="full" className="!p-0 !pb-0 !pt-0 !min-h-0 overflow-hidden">
      {/* Map Container - full viewport, fixed position to prevent scroll */}
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          top: 0, // Map goes to top, behind the floating header
          touchAction: 'none' // Prevent browser handling of touch gestures
        }}
      >
        {/* Map Area - full container */}
        <div className="absolute inset-0">
        {/* Loading Overlay */}
        {loading && !mapReady && (
          <div className="absolute inset-0 bg-background flex items-center justify-center z-10">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="wewrite-card p-3 flex items-center gap-3 bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
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

        {/* Share Button - top right */}
        {mapReady && (
          <button
            onClick={handleShare}
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background border border-border shadow-lg hover:bg-muted transition-colors"
            aria-label="Share map view"
          >
            {shareSuccess ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <Share2 className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Bottom Page Cards - Carousel with peeking cards */}
        {pages.length > 0 && !showNewPinDrawer && (
          <div className="absolute bottom-24 left-0 right-0 z-10" style={{ touchAction: 'pan-x' }}>
            {/* Floating Navigation Buttons - positioned relative to carousel */}
            {pages.length > 1 && (
              <>
                <button
                  onClick={navigateToPrevious}
                  className="absolute left-2 bottom-4 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border shadow-lg hover:bg-muted transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={navigateToNext}
                  className="absolute right-2 bottom-4 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border shadow-lg hover:bg-muted transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Carousel Container - horizontally scrollable, bottom-aligned */}
            <div
              ref={carouselRef}
              className="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div
                className="flex gap-3 px-4 md:px-0 items-end"
                style={{
                  // On mobile: 9% padding for peeking cards
                  // On desktop: center the first card with calc((100vw - cardWidth) / 2)
                  paddingLeft: 'max(9%, calc((100% - 400px) / 2))',
                  paddingRight: '9%',
                }}
              >
                {pages.map((page, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <div
                      key={page.id}
                      data-card-index={index}
                      className="flex-shrink-0 snap-center"
                      style={{
                        width: '80%',
                        minWidth: '280px',
                        maxWidth: '400px',
                        opacity: isActive ? 1 : 0.7,
                        transform: isActive ? 'scale(1)' : 'scale(0.95)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease'
                      }}
                    >
                      <div
                        className="wewrite-card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => {
                          if (isActive) {
                            router.push(`/${page.id}`);
                          } else {
                            setSelectedIndex(index);
                          }
                        }}
                      >
                        {/* Content */}
                        <div className="space-y-2">
                          {/* Page Title as Pill Link */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <PillLink
                              href={`/${page.id}`}
                              pageId={page.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {page.title}
                            </PillLink>
                          </div>

                          {/* Username */}
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-sm text-muted-foreground">by</span>
                            <UsernameBadge
                              userId={page.userId}
                              username={page.username}
                              variant="pill"
                              showBadge={false}
                            />
                          </div>

                          {/* Embedded Allocation Bar - show on all cards */}
                          <div onClick={(e) => e.stopPropagation()} className="pt-1">
                            <EmbeddedAllocationBar
                              pageId={page.id}
                              authorId={page.userId}
                              pageTitle={page.title}
                              source="MapCard"
                              disableDetailModal={false}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && pages.length === 0 && mapReady && !showNewPinDrawer && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="wewrite-card p-6 text-center space-y-3">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No pages with locations</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tap anywhere on the map to add a page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator for refetch */}
        {loading && mapReady && (
          <div className="absolute top-4 right-4 z-10">
            <div className="wewrite-card p-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}

        </div>
      </div>

      {/* New Pin Drawer - using proper Drawer component, no overlay to see pin */}
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
              <Plus className="h-5 w-5" />
              Create new page
            </Button>
            <Button
              variant="secondary"
              onClick={handleLinkExistingPage}
              className="w-full justify-start gap-3"
            >
              <Link2 className="h-5 w-5" />
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
        <div className="fixed inset-0 flex items-center justify-center" style={{ top: 0 }}>
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </NavPageLayout>
    }>
      <MapPageContent />
    </Suspense>
  );
}
