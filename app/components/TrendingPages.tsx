"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { PillLink } from './PillLink';
import { Flame, Loader } from 'lucide-react';
import SimpleSparkline from './SimpleSparkline';
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span>Trending Pages</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span>Trending Pages</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive p-4 text-center">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trendingPages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span>Trending Pages</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground p-4 text-center">
            No trending pages found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span>Trending Pages</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm">Page</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm">Views (24h)</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm">Trend</th>
                </tr>
              </thead>
              <tbody>
                {trendingPages.map((page) => (
                  <tr key={page.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <PillLink
                        href={`/${page.id}`}
                        label={page.title || 'Untitled'}
                        truncate={true}
                      />
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
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
