"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import Header from '../components/layout/Header';
import TrendingPages from '../components/features/TrendingPages';
import { TrendingUp, BarChart3, Flame } from 'lucide-react';
import { Button } from '../components/ui/button';
import MobileBottomNav from '../components/layout/MobileBottomNav';

/**
 * Trending Pages Full Page Experience
 * 
 * Dedicated page for discovering trending pages with enhanced functionality:
 * - Full page layout with header
 * - Enhanced trending pages component with more results
 * - Analytics and insights
 * - Better discovery experience for popular content
 */
export default function TrendingPagesPage() {
  const { user, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle refresh button click
  const handleRefresh = () => {
    // Trigger a refresh by dispatching a custom event
    const refreshEvent = new CustomEvent('refreshTrendingPages');
    window.dispatchEvent(refreshEvent);
  };

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading trending pages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content area */}
      <main className="transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 py-6">
          {/* Page Header with Controls */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">Trending Pages</h1>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Refresh Button */}
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="flex items-center gap-2 rounded-2xl h-8 px-3"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>
            
            <p className="text-muted-foreground text-lg">
              Discover the most popular and trending content on WeWrite. See what's capturing attention right now.
            </p>
          </div>

          {/* Trending Pages Content */}
          <div className="min-h-[600px]">
            <TrendingPages limit={25} showSparklines={true} priority="high" />
          </div>

          {/* Additional Info */}
          <div className="mt-12 p-6 bg-muted/30 rounded-lg">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              About Trending Pages
            </h2>
            <div className="space-y-2 text-muted-foreground">
              <p>
                Trending pages are ranked based on recent activity, views, and engagement. 
                The algorithm considers both total views and recent momentum to surface content that's gaining traction.
              </p>
              <p>
                Pages with higher view counts in the last 24 hours are prioritized, helping you discover 
                what's currently popular and relevant in the WeWrite community.
              </p>
              <p>
                The sparkline charts show view trends over time, giving you insight into how each page's 
                popularity has evolved recently.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
