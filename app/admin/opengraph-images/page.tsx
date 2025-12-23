"use client";

import React, { useState, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
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
  section: 'branding' | 'content' | 'user' | 'static' | 'auth' | 'missing';
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

  // === USER PROFILES ===
  {
    id: 'user-profile',
    name: 'User Profile',
    description: 'Dynamic OG image for user profile pages showing username, bio, and page count.',
    route: '/u/jamie/opengraph-image',
    usedIn: ['User profiles', 'Social shares'],
    customParams: {},
    section: 'user',
  },

  // === AUTH PAGES ===
  {
    id: 'auth-login',
    name: 'Login Page',
    description: 'OG image for the login page with form preview.',
    route: '/auth/login/opengraph-image',
    usedIn: ['Login page'],
    customParams: {},
    section: 'auth',
  },
  {
    id: 'auth-register',
    name: 'Register Page',
    description: 'OG image for the registration page with signup form preview.',
    route: '/auth/register/opengraph-image',
    usedIn: ['Registration page'],
    customParams: {},
    section: 'auth',
  },

  // === STATIC PAGES ===
  {
    id: 'home-feed',
    name: 'Home Feed',
    description: 'OG image for the logged-in home feed page.',
    route: '/home/opengraph-image',
    usedIn: ['Home page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'trending',
    name: 'Trending',
    description: 'OG image for the trending pages view.',
    route: '/trending/opengraph-image',
    usedIn: ['Trending page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'OG image for the search page.',
    route: '/search/opengraph-image',
    usedIn: ['Search page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    description: 'OG image for the leaderboard page.',
    route: '/leaderboard/opengraph-image',
    usedIn: ['Leaderboard page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'invite',
    name: 'Invite Friends',
    description: 'OG image for the referral invite page.',
    route: '/invite/opengraph-image',
    usedIn: ['Invite page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'OG image for the welcome/landing page.',
    route: '/welcome/opengraph-image',
    usedIn: ['Welcome page', 'Landing pages'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'terms',
    name: 'Terms of Service',
    description: 'OG image for the terms of service page.',
    route: '/terms/opengraph-image',
    usedIn: ['Terms page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'privacy',
    name: 'Privacy Policy',
    description: 'OG image for the privacy policy page.',
    route: '/privacy/opengraph-image',
    usedIn: ['Privacy page'],
    customParams: {},
    section: 'static',
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
// Note: All major routes now have custom OG images as of Dec 2024
const ROUTES_NEEDING_AUDIT: { path: string; description: string; priority: string }[] = [
  // All previously listed routes now have custom OG images!
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
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
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
              <Icon name="ArrowLeft" size={20} />
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
                <Icon name="Grid" size={16} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
              >
                <Icon name="List" size={16} />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="gap-2"
            >
              <Icon name="RefreshCw" size={16} />
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
              <Icon name="Search" size={20} className="text-muted-foreground" />
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
                    <Icon name="Loader" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Icon name="Search" size={16} />
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
                  <Icon name="X" size={16} />
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
                            <Icon name="Loader" className="text-primary" />
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

              {/* User Profiles Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  User Profiles
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'user').map((ogType) => (
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
                            <Icon name="Loader" className="text-primary" />
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

              {/* Auth Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  Auth Pages
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'auth').map((ogType) => (
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
                            <Icon name="Loader" className="text-primary" />
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

              {/* Static Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500" />
                  Static Pages
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'static').map((ogType) => (
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
                            <Icon name="Loader" className="text-primary" />
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
                            <Icon name="Loader" className="text-primary" />
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
                                <Icon name="Loader" className="text-primary" />
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

              {/* User Profiles Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  User Profiles
                </h2>
                <div className="space-y-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'user').map((ogType) => (
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
                                <Icon name="Loader" className="text-primary" />
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

              {/* Auth Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  Auth Pages
                </h2>
                <div className="space-y-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'auth').map((ogType) => (
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
                                <Icon name="Loader" className="text-primary" />
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

              {/* Static Pages Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500" />
                  Static Pages
                </h2>
                <div className="space-y-4">
                  {OG_IMAGE_TYPES.filter(t => t.section === 'static').map((ogType) => (
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
                                <Icon name="Loader" className="text-primary" />
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
                                <Icon name="Loader" className="text-primary" />
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

          {/* Implementation Documentation */}
          <div className="wewrite-card mt-8">
            <h3 className="text-lg font-semibold mb-4">Implementation Documentation</h3>

            <div className="space-y-6">
              {/* Design System */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">Design System</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>All OG images follow a consistent visual language:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><strong>Background:</strong> Solid black (#000) base</li>
                    <li><strong>Gradient Blobs:</strong> 3 large blurred circles (800-900px) with 45-55% opacity, blur radius of 80px</li>
                    <li><strong>Sparkles:</strong> 8 subtle white dots (2-4px) scattered at various opacities (0.5-0.9)</li>
                    <li><strong>Typography:</strong> System UI font, headings at fontWeight 800, body at fontWeight 500</li>
                    <li><strong>Colors:</strong> Blue (#3B82F6), Purple (#8B5CF6), Green (#22C55E) primary accents</li>
                  </ul>
                </div>
              </div>

              {/* Layout Types */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">Layout Types</h4>
                <div className="text-sm text-muted-foreground space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Split Layout (55/45)</p>
                    <p>Used for: Login, Register, Invite, Trending, Leaderboard</p>
                    <p>Left side has marketing copy, right side has UI preview or cards</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Centered Layout</p>
                    <p>Used for: Search, Terms, Privacy, Welcome</p>
                    <p>Icon/graphic at top, centered title and subtitle, optional action items below</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Content Layout</p>
                    <p>Used for: Dynamic page OG images (/api/og)</p>
                    <p>Full-width title (72px, 3-line max), inline link pills, gradient fade to footer</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Profile Layout</p>
                    <p>Used for: User profile pages (/u/[username])</p>
                    <p>Avatar + username header, bio section, gradient footer with CTA button</p>
                  </div>
                </div>
              </div>

              {/* Shared Components */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">Shared Components Library</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>All OG images should import from <code className="bg-muted px-1 rounded">@/app/lib/og-components</code> for consistency:</p>
                  <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p><span className="text-blue-400">OG_STYLES</span> - Design tokens (colors, fonts, sizes, shadows)</p>
                    <p><span className="text-green-400">OGBlobs</span> - Gradient blob backgrounds with theme prop</p>
                    <p><span className="text-purple-400">OGSparkles</span> - Subtle sparkle dots decoration</p>
                    <p><span className="text-yellow-400">OGFooter</span> - WeWrite logo footer</p>
                    <p><span className="text-cyan-400">ogTitleStyle / ogSubtitleStyle</span> - Typography styles</p>
                    <p><span className="text-orange-400">truncateText / extractPlainText</span> - Utility functions</p>
                  </div>
                  <p className="text-xs mt-2">To update all OG images at once, modify the shared component file.</p>
                </div>
              </div>

              {/* File Locations */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">File Locations</h4>
                <div className="text-sm text-muted-foreground">
                  <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p><span className="text-pink-400">Shared components:</span> app/lib/og-components.tsx</p>
                    <p><span className="text-blue-400">Static pages:</span> app/[route]/opengraph-image.tsx</p>
                    <p><span className="text-green-400">Content pages:</span> app/api/og/route.tsx</p>
                    <p><span className="text-purple-400">User profiles:</span> app/u/[username]/opengraph-image.tsx</p>
                    <p><span className="text-yellow-400">Auth pages:</span> app/auth/[action]/opengraph-image.tsx</p>
                  </div>
                </div>
              </div>

              {/* Blob Color Themes */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">Blob Color Themes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Default (Blue/Purple/Green)</p>
                    <p className="text-muted-foreground">Welcome, Home, Content, User Profiles</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Blue Tones</p>
                    <p className="text-muted-foreground">Login, Register, Leaderboard, Search</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Orange/Red</p>
                    <p className="text-muted-foreground">Trending page</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">Green Accent</p>
                    <p className="text-muted-foreground">Invite, Privacy pages</p>
                  </div>
                </div>
              </div>

              {/* Best Practices */}
              <div>
                <h4 className="text-md font-semibold mb-2 text-primary">Best Practices</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Always include the WeWrite logo in footer (72x72px with border)</li>
                  <li>Use textShadow on headings for depth against gradient backgrounds</li>
                  <li>Keep body text at 0.85-0.9 opacity for readability</li>
                  <li>Blobs should overflow the canvas for seamless edges</li>
                  <li>Title should be truncated to 3 lines max with overflow: hidden</li>
                  <li>Test with Facebook Debugger and Twitter Card Validator after changes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
