"use client";

import React, { useState, useEffect } from 'react';

import PillLink from './PillLink.js';
import { Flame, Loader } from 'lucide-react';
import SimpleSparkline from './SimpleSparkline.js';
import Link from 'next/link';
import { getPageViewsLast24Hours, getTrendingPages } from '../firebase/pageViews';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
}

export default function TrendingPages({ limit = 5 }) {
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);

        // Get trending pages for the last 24 hours
        const pages = await getTrendingPages(limit);

        // For each page, get the hourly view data for sparklines
        const pagesWithSparklines = await Promise.all(
          pages.map(async (page) => {
            try {
              const viewData = await getPageViewsLast24Hours(page.id);
              return {
                ...page,
                hourlyViews: viewData.hourly || Array(24).fill(0)
              };
            } catch (err) {
              console.error(`Error fetching view data for page ${page.id}:`, err);
              return {
                ...page,
                hourlyViews: Array(24).fill(0)
              };
            }
          })
        );

        setTrendingPages(pagesWithSparklines);
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError('Failed to load trending pages');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingPages();
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center items-center py-8">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-lg overflow-hidden">
          <div className="text-destructive p-4 text-center">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (trendingPages.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-lg overflow-hidden">
          <div className="text-muted-foreground p-4 text-center">
            No trending pages found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Desktop view (md and up): Table layout */}
      <div className="hidden md:block border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Page</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Views (24h)</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Trend</th>
            </tr>
          </thead>
          <tbody>
            {trendingPages.map((page) => (
              <tr
                key={page.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/${page.id}`}
              >
                <td className="py-3 px-4">
                  <span className="inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap max-w-full px-2 py-0.5 bg-primary text-primary-foreground">
                    <span className="pill-text">{page.title || 'Untitled'}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  {page.views.toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <div className="w-24 h-12 ml-auto">
                    <SimpleSparkline
                      data={page.hourlyViews}
                      height={40}
                      color="#1768FF"
                      strokeWidth={1.5}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view (smaller than md): Card grid layout */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {trendingPages.map((page) => (
          <Link
            href={`/${page.id}`}
            key={page.id}
            className="group block bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-medium">
                  <span className="inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap max-w-full px-2 py-0.5 bg-primary text-primary-foreground">
                    <span className="pill-text">{page.title || 'Untitled'}</span>
                  </span>
                </h3>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="font-medium text-lg">
                    {page.views.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    views in 24h
                  </div>
                </div>

                <div className="w-28 h-14 bg-background/50 rounded-md p-1">
                  <SimpleSparkline
                    data={page.hourlyViews}
                    height={48}
                    color="#1768FF"
                    strokeWidth={2}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
