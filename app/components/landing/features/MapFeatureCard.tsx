"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { getMapTileConfig } from '../../../utils/mapConfig';
import { useLandingColors, LIGHTNESS, CHROMA } from '../LandingColorContext';

/**
 * MapFeatureCard Component
 *
 * Shows a world map preview using Leaflet with fake pins scattered over land.
 * Non-interactive preview for the landing page.
 * Uses scroll-animated accent color for pins.
 */

// Pre-generated fake locations - US cities only
const FAKE_LAND_LOCATIONS = [
  { lat: 40.7128, lng: -74.006 },   // New York
  { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  { lat: 41.8781, lng: -87.6298 },  // Chicago
  { lat: 29.7604, lng: -95.3698 },  // Houston
  { lat: 47.6062, lng: -122.3321 }, // Seattle
  { lat: 25.7617, lng: -80.1918 },  // Miami
  { lat: 33.749, lng: -84.388 },    // Atlanta
  { lat: 42.3601, lng: -71.0589 },  // Boston
  { lat: 39.7392, lng: -104.9903 }, // Denver
  { lat: 33.4484, lng: -112.074 },  // Phoenix
  { lat: 37.7749, lng: -122.4194 }, // San Francisco
  { lat: 32.7157, lng: -117.1611 }, // San Diego
  { lat: 29.9511, lng: -90.0715 },  // New Orleans
  { lat: 36.1627, lng: -86.7816 },  // Nashville
  { lat: 45.5152, lng: -122.6784 }, // Portland
  { lat: 39.0997, lng: -94.5786 },  // Kansas City
  { lat: 35.2271, lng: -80.8431 },  // Charlotte
  { lat: 38.9072, lng: -77.0369 },  // Washington DC
  { lat: 44.9778, lng: -93.265 },   // Minneapolis
  { lat: 30.2672, lng: -97.7431 },  // Austin
];

// Helper to convert OKLCH to hex
function oklchToHex(l: number, c: number, h: number): string {
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const toSrgb = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 255;
    return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055) * 255);
  };

  const rr = toSrgb(r).toString(16).padStart(2, '0');
  const gg = toSrgb(g).toString(16).padStart(2, '0');
  const bb = toSrgb(bl).toString(16).padStart(2, '0');

  return `#${rr}${gg}${bb}`;
}

export default function MapFeatureCard() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { hue } = useLandingColors();

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import of Leaflet
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current) return;

      // Centered on United States
      const map = L.map(mapRef.current, {
        center: [39, -98],
        zoom: 3,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
      });

      // Add tile layer
      const tileConfig = getMapTileConfig(isDark);
      L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsLoaded(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isDark]);

  // Add fake markers over land
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const L = require('leaflet');
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Get accent color from hue
    const accentHex = oklchToHex(LIGHTNESS, CHROMA, hue);

    // Create custom icon with accent color
    const createPinIcon = () => {
      return L.divIcon({
        className: 'custom-map-pin',
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${accentHex}" stroke="${accentHex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20],
      });
    };

    // Add markers for each fake location
    FAKE_LAND_LOCATIONS.forEach((location) => {
      const marker = L.marker([location.lat, location.lng], {
        icon: createPinIcon(),
        interactive: false,
      }).addTo(map);
      markersRef.current.push(marker);
    });
  }, [isLoaded, hue]);

  return (
    <div className="relative h-full min-h-[200px] overflow-hidden rounded-lg">
      {/* Map container */}
      <div
        ref={mapRef}
        className="absolute inset-0 z-0 rounded-lg"
        style={{ background: isDark ? '#1a1a2e' : '#e8e8e8' }}
      />

      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Custom styles for pins */}
      <style jsx global>{`
        .custom-map-pin {
          background: transparent !important;
          border: none !important;
        }
        .custom-map-pin svg {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }
      `}</style>
    </div>
  );
}
