"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, ExternalLink, Loader, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { FloatingHeader } from '../../components/ui/FloatingCard';

interface OGImageType {
  id: string;
  name: string;
  description: string;
  route: string;
  previewUrl: string;
  params?: Record<string, string>;
  usedIn: string[];
}

const OG_IMAGE_TYPES: OGImageType[] = [
  {
    id: 'default',
    name: 'Default WeWrite',
    description: 'Default branding image shown when sharing the homepage or pages without specific metadata.',
    route: '/opengraph-image',
    previewUrl: '/opengraph-image',
    usedIn: ['Homepage', 'Fallback for all pages'],
  },
  {
    id: 'api-default',
    name: 'API Default Branding',
    description: 'Dynamic API route that returns WeWrite branding when no page ID is provided.',
    route: '/api/og',
    previewUrl: '/api/og',
    usedIn: ['API fallback'],
  },
  {
    id: 'api-test',
    name: 'Test Image (Red)',
    description: 'Simple red test image to verify the OG image generation pipeline is working.',
    route: '/api/og?id=test',
    previewUrl: '/api/og?id=test',
    usedIn: ['Debug/Testing'],
  },
  {
    id: 'content-page',
    name: 'Content Page',
    description: 'Dynamic OG image for content pages showing title, author, content preview, and sponsor count.',
    route: '/api/og?id={pageId}',
    previewUrl: '/api/og?id=sample&title=Example%20Page%20Title&author=JohnDoe&content=This%20is%20a%20preview%20of%20what%20the%20content%20looks%20like%20when%20shared%20on%20social%20media.&sponsors=5',
    params: {
      id: 'Page ID',
      title: 'Page title (optional)',
      author: 'Author username (optional)',
      content: 'Content preview (optional)',
      sponsors: 'Sponsor count (optional)',
    },
    usedIn: ['Individual content pages', 'Social media shares'],
  },
  {
    id: 'api-png',
    name: 'PNG Format',
    description: 'Same as content page but served from /api/og.png route for compatibility.',
    route: '/api/og.png',
    previewUrl: '/api/og.png?id=sample&title=PNG%20Format%20Example&author=TestUser&content=This%20demonstrates%20the%20PNG%20endpoint%20variant.&sponsors=3',
    usedIn: ['Alternative endpoint'],
  },
];

export default function OpenGraphImagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

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
      <div className="py-6 px-4 container mx-auto max-w-5xl">
        <FloatingHeader className="fixed top-3 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 z-40 px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh All
          </Button>
        </FloatingHeader>

        <div className="space-y-8 pt-24 lg:pt-0">
          <div className="mb-4">
            <p className="text-muted-foreground">
              These are all the OpenGraph images used when WeWrite pages are shared on social media.
              Each design is generated dynamically based on the context.
            </p>
          </div>

          {OG_IMAGE_TYPES.map((ogType) => (
            <div key={ogType.id} className="wewrite-card">
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold">{ogType.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {ogType.id}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ogType.description}</p>
                  </div>
                  <a
                    href={ogType.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </a>
                </div>

                {/* Route info */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <code className="text-sm text-muted-foreground">{ogType.route}</code>
                </div>

                {/* Parameters if any */}
                {ogType.params && (
                  <div>
                    <p className="text-sm font-medium mb-2">Parameters:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ogType.params).map(([key, desc]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {desc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Used in */}
                <div>
                  <p className="text-sm font-medium mb-2">Used in:</p>
                  <div className="flex flex-wrap gap-2">
                    {ogType.usedIn.map((use) => (
                      <Badge key={use} variant="secondary" className="text-xs">
                        {use}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-2">
                  <p className="text-sm font-medium mb-2">Preview (1200×630):</p>
                  <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30" style={{ aspectRatio: '1200/630' }}>
                    {loadingImages[ogType.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <Loader className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${ogType.id}-${refreshKey}`}
                      src={ogType.previewUrl}
                      alt={`${ogType.name} preview`}
                      className="w-full h-full object-cover"
                      onLoadStart={() => handleImageLoadStart(ogType.id)}
                      onLoad={() => handleImageLoad(ogType.id)}
                      onError={() => handleImageLoad(ogType.id)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Technical Notes */}
          <div className="wewrite-card bg-muted/30">
            <h3 className="text-lg font-semibold mb-3">Technical Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>All OG images are generated using Next.js <code className="bg-muted px-1 rounded">ImageResponse</code> from <code className="bg-muted px-1 rounded">next/og</code></li>
              <li>Images are generated at the edge runtime for fast delivery</li>
              <li>Standard OG image size is 1200×630 pixels</li>
              <li>The <code className="bg-muted px-1 rounded">/api/og</code> route dynamically fetches page data if only an ID is provided</li>
              <li>Content is automatically stripped of HTML tags and truncated for display</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
