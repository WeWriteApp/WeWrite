"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Loader, RefreshCw, Image as ImageIcon, Grid, List, Search, X } from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { FloatingHeader } from '../../components/ui/FloatingCard';

interface OGImageType {
  id: string;
  name: string;
  description: string;
  route: string;
  params?: Record<string, string>;
  usedIn: string[];
  customParams: Record<string, string>;
  section: 'branding' | 'content' | 'user' | 'static' | 'missing';
}

const OG_IMAGE_TYPES: OGImageType[] = [
  // === BRANDING IMAGES ===
  {
    id: 'default',
    name: 'Default WeWrite',
    description: 'Default branding image shown when sharing the homepage.',
    route: '/opengraph-image',
    usedIn: ['Homepage', 'Fallback'],
    customParams: {},
    section: 'branding',
  },
  {
    id: 'api-default',
    name: 'API Default',
    description: 'API route returning WeWrite branding when no page ID provided.',
    route: '/api/og',
    usedIn: ['API fallback'],
    customParams: {},
    section: 'branding',
  },

  // === CONTENT PAGE VARIANTS ===
  {
    id: 'content-page-sample',
    name: 'Content Page (Sample)',
    description: 'Dynamic OG image with title, author, content preview.',
    route: '/api/og',
    params: {
      id: 'Page ID',
      title: 'Page title',
      author: 'Author username',
      content: 'Content preview',
      sponsors: 'Sponsor count',
    },
    usedIn: ['Content pages', 'Social shares'],
    customParams: {
      title: 'The Future of AI in Education',
      author: 'sarah_chen',
      content: 'Exploring how artificial intelligence is transforming learning experiences for millions of students worldwide. From personalized tutoring with Khan Academy to adaptive curricula that adjust to individual learning styles, AI is reshaping education. Schools use machine learning to identify learning gaps and create customized study plans. Teachers leverage Gradescope and automated essay scoring to manage workloads. Startups like Duolingo use gamification and AI to make learning languages engaging. Institutions implement intelligent tutoring systems for personalized feedback. AI-powered platforms analyze student performance data in real-time.',
      sponsors: '12',
    },
    section: 'content',
  },
  {
    id: 'content-with-sponsors',
    name: 'Page with Sponsors',
    description: 'Content page showing sponsor count badge.',
    route: '/api/og',
    usedIn: ['Popular pages'],
    customParams: {
      title: 'How to Build a Sustainable Startup',
      author: 'alex_rivera',
      content: "A comprehensive guide to building businesses that balance profit with purpose while maintaining competitive advantage. Learn actionable strategies via B Lab certification, ESG frameworks, and conscious capitalism principles. Discover how companies like Patagonia and Ben & Jerry's built billion-dollar brands on sustainability. Explore funding options through impact investors and ESG-focused venture capital firms. Implement circular economy practices, carbon offsetting, and ethical supply chain management. Learn about double bottom-line reporting, stakeholder capitalism, and stakeholder engagement models that drive long-term value creation.",
      sponsors: '47',
    },
    section: 'content',
  },
  {
    id: 'content-no-sponsors',
    name: 'Page without Sponsors',
    description: 'Content page with no sponsor badge.',
    route: '/api/og',
    usedIn: ['New pages'],
    customParams: {
      title: 'Homemade Sourdough Starter Guide',
      author: 'baker_mike',
      content: 'Everything you need about creating and maintaining sourdough starter from scratch. Day one feeding schedules, weekly maintenance routines, and troubleshooting with expert baking resources. Understand the fermentation science behind wild yeast and bacteria cultures. Learn temperature control techniques, hydration ratios, and achieving the perfect crumb structure. Discover common starter problems like mold and separation, with proven solutions. Master the autolyse method, stretch-and-fold techniques, and optimal baking temperatures for crispy crust. Explore different flour types and their effects on fermentation and flavor development.',
      sponsors: '0',
    },
    section: 'content',
  },
  {
    id: 'content-long-title',
    name: 'Long Title',
    description: 'Tests title truncation with very long page title.',
    route: '/api/og',
    usedIn: ['Edge case testing'],
    customParams: {
      title: 'The Comprehensive Guide to Understanding Blockchain Technology: How Distributed Ledgers Are Revolutionizing Finance, Supply Chains, and Beyond',
      author: 'crypto_professor',
      content: 'An in-depth exploration of blockchain fundamentals using Bitcoin and Ethereum as primary case studies. Understand the cryptographic principles that secure decentralized networks. Explore smart contracts on Solana and Polygon, NFTs and tokenomics, and DeFi protocols reshaping finance. Discover real-world applications across supply chain management, healthcare data sharing, and voting systems. Learn about consensus mechanisms like Proof of Work and Proof of Stake, transaction throughput, and layer-two scaling solutions. Understand regulatory landscapes and enterprise blockchain implementations. Explore emerging use cases in digital identity.',
      sponsors: '23',
    },
    section: 'content',
  },
  {
    id: 'api-png',
    name: 'PNG Format',
    description: 'Same as content page but served from /api/og.png route.',
    route: '/api/og.png',
    usedIn: ['Alternative endpoint'],
    customParams: {
      title: 'Photography 101: Mastering Light and Composition',
      author: 'lens_master',
      content: 'Learn photography fundamentals including exposure control, ISO sensitivity, and aperture priority modes. Master zone system and metering techniques for perfect exposure. Study composition rules like the rule of thirds, leading lines, and framing techniques. Understand color theory, white balance, and how light direction affects mood and dimension. Learn post-processing workflows with professional tools for stunning results. Explore different genres from portrait lighting to landscape and macro photography. Study masters like Henri Cartier-Bresson to develop artistic vision. Practice advanced techniques like bracketing, focus stacking, and creative use of depth of field.',
      sponsors: '8',
    },
    section: 'content',
  },
];

// Routes that need OG image audit - these don't have dedicated opengraph-image files
const ROUTES_NEEDING_AUDIT = [
  { path: '/u/[username]', description: 'User profile pages', priority: 'high' },
  { path: '/auth/login', description: 'Login page', priority: 'medium' },
  { path: '/auth/register', description: 'Registration page', priority: 'medium' },
  { path: '/home', description: 'Logged-in home feed', priority: 'medium' },
  { path: '/trending', description: 'Trending pages', priority: 'medium' },
  { path: '/search', description: 'Search page', priority: 'low' },
  { path: '/leaderboard', description: 'Leaderboard page', priority: 'low' },
  { path: '/invite', description: 'Invite page', priority: 'medium' },
  { path: '/welcome', description: 'Welcome/onboarding flow', priority: 'medium' },
  { path: '/terms', description: 'Terms of service', priority: 'low' },
  { path: '/privacy', description: 'Privacy policy', priority: 'low' },
];

export default function OpenGraphImagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lookupPageId, setLookupPageId] = useState('');
  const [lookupPageData, setLookupPageData] = useState<any | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Check if user is admin
  React.useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/opengraph-images');
    }
  }, [user, authLoading, router]);

  const handleLookupPage = useCallback(async () => {
    if (!lookupPageId.trim()) {
      setLookupPageData(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(lookupPageId)}`);
      if (response.ok) {
        const data = await response.json();
        setLookupPageData(data);
      } else {
        setLookupPageData(null);
      }
    } catch (error) {
      console.error('Error looking up page:', error);
      setLookupPageData(null);
    } finally {
      setIsLookingUp(false);
    }
  }, [lookupPageId]);

  const handleClearLookup = useCallback(() => {
    setLookupPageId('');
    setLookupPageData(null);
  }, []);

  const buildPreviewUrl = useCallback((route: string, params: Record<string, string>): string => {
    if (Object.keys(params).length === 0) {
      return `${route}?t=${Date.now()}`;
    }
    const searchParams = new URLSearchParams(params);
    return `${route}?${searchParams.toString()}&t=${Date.now()}`;
  }, []);

  const buildLookupPreviewUrl = useCallback((route: string): string => {
    if (!lookupPageData) {
      return route;
    }

    // Extract content preview from rich content if needed
    let contentPreview = '';
    if (lookupPageData.content) {
      try {
        const parsed = JSON.parse(lookupPageData.content);
        if (Array.isArray(parsed)) {
          contentPreview = parsed
            .map((node: any) => {
              if (node.children) {
                return node.children
                  .map((child: any) => child.text || '')
                  .join('')
                  .trim();
              }
              return '';
            })
            .join(' ')
            .trim()
            .substring(0, 300);
        }
      } catch {
        contentPreview = String(lookupPageData.content).substring(0, 300);
      }
    }

    const params = {
      id: lookupPageData.id,
      title: lookupPageData.title || 'Untitled',
      author: lookupPageData.authorUsername || lookupPageData.username || 'WeWrite User',
      content: contentPreview || 'No content preview available',
      sponsors: String(lookupPageData.sponsorCount || 0),
    };

    const searchParams = new URLSearchParams(params);
    return `${route}?${searchParams.toString()}`;
  }, [lookupPageData]);

  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleImageLoad = (id: string) => {
    setLoadingImages(prev => ({ ...prev, [id]: false }));
  };

  const handleImageLoadStart = (id: string) => {
    setLoadingImages(prev => ({ ...prev, [id]: true }));
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        <FloatingHeader className="fixed-header-sidebar-aware px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold leading-tight">OpenGraph Images</h1>
              <p className="text-muted-foreground text-sm">
                Preview all OG image designs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </FloatingHeader>

        <div className="pt-24 lg:pt-0">
          <p className="text-muted-foreground mb-6">
            OpenGraph images used when WeWrite pages are shared on social media.
          </p>

          {/* Page Lookup Section */}
          <div className="wewrite-card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Look Up a Specific Page</h3>
            </div>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter page ID..."
                value={lookupPageId}
                onChange={(e) => setLookupPageId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLookupPage()}
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleLookupPage}
                disabled={!lookupPageId.trim() || isLookingUp}
                className="gap-2"
              >
                {isLookingUp ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Look Up
                  </>
                )}
              </Button>
              {lookupPageData && (
                <Button
                  variant="outline"
                  onClick={handleClearLookup}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Lookup Result Display */}
            {lookupPageData && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-medium text-sm">{lookupPageData.title}</div>
                <div className="text-xs text-muted-foreground">by {lookupPageData.authorUsername || lookupPageData.username}</div>
                <div className="text-xs text-muted-foreground mt-1">ID: {lookupPageData.id} • Sponsors: {lookupPageData.sponsorCount || 0}</div>
              </div>
            )}
          </div>

          {viewMode === 'grid' ? (
            /* Grid View organized by sections */
            <div className="space-y-8">
              {/* Branding Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Branding Images
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'branding').map((ogType) => (
                    <div key={ogType.id} className="wewrite-card p-4">
                      <a
                        href={buildPreviewUrl(ogType.route, ogType.customParams)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative rounded-lg overflow-hidden border border-border bg-muted/30 mb-3 cursor-pointer hover:border-primary transition-colors"
                        style={{ aspectRatio: '1200/630' }}
                      >
                        {loadingImages[ogType.id] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                            <Loader className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={`${ogType.id}-${refreshKey}`}
                          src={buildPreviewUrl(ogType.route, ogType.customParams)}
                          alt={`${ogType.name} preview`}
                          className="w-full h-full object-cover"
                          onLoadStart={() => handleImageLoadStart(ogType.id)}
                          onLoad={() => handleImageLoad(ogType.id)}
                          onError={() => handleImageLoad(ogType.id)}
                        />
                      </a>
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold truncate">{ogType.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{ogType.description}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2 mb-2">
                        <code className="text-[10px] text-muted-foreground break-all">{ogType.route}</code>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ogType.usedIn.map((use) => (
                          <Badge key={use} variant="secondary-static" size="sm">{use}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  Content Page Variants
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'content').map((ogType) => (
                    <div key={ogType.id} className="wewrite-card p-4">
                      <a
                        href={buildPreviewUrl(ogType.route, ogType.customParams)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative rounded-lg overflow-hidden border border-border bg-muted/30 mb-3 cursor-pointer hover:border-primary transition-colors"
                        style={{ aspectRatio: '1200/630' }}
                      >
                        {loadingImages[ogType.id] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                            <Loader className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={`${ogType.id}-${refreshKey}`}
                          src={buildPreviewUrl(ogType.route, ogType.customParams)}
                          alt={`${ogType.name} preview`}
                          className="w-full h-full object-cover"
                          onLoadStart={() => handleImageLoadStart(ogType.id)}
                          onLoad={() => handleImageLoad(ogType.id)}
                          onError={() => handleImageLoad(ogType.id)}
                        />
                      </a>
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold truncate">{ogType.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{ogType.description}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2 mb-2">
                        <code className="text-[10px] text-muted-foreground break-all">{ogType.route}</code>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ogType.usedIn.map((use) => (
                          <Badge key={use} variant="secondary-static" size="sm">{use}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Routes Needing OG Images */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                  Routes Needing OG Images
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  These routes currently fall back to the default WeWrite branding. Consider adding custom OG images.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ROUTES_NEEDING_AUDIT.map((route) => (
                    <div key={route.path} className="wewrite-card p-4 border-l-4 border-l-orange-500">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <code className="text-sm font-mono text-foreground">{route.path}</code>
                          <p className="text-xs text-muted-foreground mt-1">{route.description}</p>
                        </div>
                        <Badge
                          variant={route.priority === 'high' ? 'destructive-static' : route.priority === 'medium' ? 'secondary-static' : 'outline-static'}
                          size="sm"
                        >
                          {route.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* List View organized by sections */
            <div className="space-y-8">
              {/* Branding Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Branding Images
                </h2>
                <div className="space-y-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'branding').map((ogType) => (
                    <div key={ogType.id} className="wewrite-card">
                      <div className="flex flex-col gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold">{ogType.name}</h3>
                            <Badge variant="secondary-static" size="sm">{ogType.id}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{ogType.description}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <code className="text-sm text-muted-foreground">{ogType.route}</code>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Used in:</p>
                          <div className="flex flex-wrap gap-2">
                            {ogType.usedIn.map((use) => (
                              <Badge key={use} variant="secondary-static" size="sm">{use}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm font-medium mb-2">Preview (1200×630):</p>
                          <a
                            href={buildPreviewUrl(ogType.route, ogType.customParams)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block relative rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer hover:border-primary transition-colors"
                            style={{ aspectRatio: '1200/630' }}
                          >
                            {loadingImages[ogType.id] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                <Loader className="h-6 w-6 animate-spin text-primary" />
                              </div>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              key={`${ogType.id}-${refreshKey}`}
                              src={buildPreviewUrl(ogType.route, ogType.customParams)}
                              alt={`${ogType.name} preview`}
                              className="w-full h-full object-cover"
                              onLoadStart={() => handleImageLoadStart(ogType.id)}
                              onLoad={() => handleImageLoad(ogType.id)}
                              onError={() => handleImageLoad(ogType.id)}
                            />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  Content Page Variants
                </h2>
                <div className="space-y-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'content').map((ogType) => (
                    <div key={ogType.id} className="wewrite-card">
                      <div className="flex flex-col gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold">{ogType.name}</h3>
                            <Badge variant="secondary-static" size="sm">{ogType.id}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{ogType.description}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <code className="text-sm text-muted-foreground">{ogType.route}</code>
                        </div>
                        {ogType.params && (
                          <div>
                            <p className="text-sm font-medium mb-2">Parameters:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(ogType.params).map(([key, desc]) => (
                                <Badge key={key} variant="outline-static" size="sm">{key}: {desc}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium mb-2">Used in:</p>
                          <div className="flex flex-wrap gap-2">
                            {ogType.usedIn.map((use) => (
                              <Badge key={use} variant="secondary-static" size="sm">{use}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm font-medium mb-2">Preview (1200×630):</p>
                          <a
                            href={buildPreviewUrl(ogType.route, ogType.customParams)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block relative rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer hover:border-primary transition-colors"
                            style={{ aspectRatio: '1200/630' }}
                          >
                            {loadingImages[ogType.id] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                <Loader className="h-6 w-6 animate-spin text-primary" />
                              </div>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              key={`${ogType.id}-${refreshKey}`}
                              src={buildPreviewUrl(ogType.route, ogType.customParams)}
                              alt={`${ogType.name} preview`}
                              className="w-full h-full object-cover"
                              onLoadStart={() => handleImageLoadStart(ogType.id)}
                              onLoad={() => handleImageLoad(ogType.id)}
                              onError={() => handleImageLoad(ogType.id)}
                            />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Routes Needing OG Images */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                  Routes Needing OG Images
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  These routes currently fall back to the default WeWrite branding. Consider adding custom OG images.
                </p>
                <div className="space-y-2">
                  {ROUTES_NEEDING_AUDIT.map((route) => (
                    <div key={route.path} className="wewrite-card p-4 border-l-4 border-l-orange-500">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <code className="text-sm font-mono text-foreground">{route.path}</code>
                          <p className="text-xs text-muted-foreground mt-1">{route.description}</p>
                        </div>
                        <Badge
                          variant={route.priority === 'high' ? 'destructive-static' : route.priority === 'medium' ? 'secondary-static' : 'outline-static'}
                          size="sm"
                        >
                          {route.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Technical Notes */}
          <div className="wewrite-card bg-muted/30 mt-8">
            <h3 className="text-lg font-semibold mb-3">Technical Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>All OG images are generated using Next.js <code className="bg-muted px-1 rounded">ImageResponse</code> from <code className="bg-muted px-1 rounded">next/og</code></li>
              <li>Images are generated at the edge runtime for fast delivery</li>
              <li>Standard OG image size is 1200×630 pixels</li>
              <li>The <code className="bg-muted px-1 rounded">/api/og</code> route accepts query params: id, title, author, content, sponsors</li>
              <li>Content is automatically stripped of HTML tags and truncated for display</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
