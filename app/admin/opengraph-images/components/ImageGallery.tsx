import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { ImageGallerySection } from './ImageGallerySection';
import { OG_IMAGE_TYPES, ROUTES_NEEDING_AUDIT } from '../config';

interface ImageGalleryProps {
  viewMode: 'grid' | 'list';
  refreshKey: number;
  loadingImages: Record<string, boolean>;
  buildPreviewUrl: (route: string, params: Record<string, string>) => string;
  onImageLoadStart: (id: string) => void;
  onImageLoad: (id: string) => void;
}

const SECTIONS = [
  { section: 'branding' as const, title: 'Branding Images', dotColor: 'bg-blue-500' },
  { section: 'user' as const, title: 'User Profiles', dotColor: 'bg-purple-500' },
  { section: 'auth' as const, title: 'Auth Pages', dotColor: 'bg-yellow-500' },
  { section: 'static' as const, title: 'Static Pages', dotColor: 'bg-cyan-500' },
  { section: 'content' as const, title: 'Content Page Variants', dotColor: 'bg-green-500' },
] as const;

export function ImageGallery({ viewMode, refreshKey, loadingImages, buildPreviewUrl, onImageLoadStart, onImageLoad }: ImageGalleryProps) {
  return (
    <div className="space-y-8">
      {SECTIONS.map(({ section, title, dotColor }) => (
        <ImageGallerySection
          key={section}
          title={title}
          dotColor={dotColor}
          items={OG_IMAGE_TYPES.filter(t => t.section === section)}
          viewMode={viewMode}
          refreshKey={refreshKey}
          loadingImages={loadingImages}
          buildPreviewUrl={buildPreviewUrl}
          onImageLoadStart={onImageLoadStart}
          onImageLoad={onImageLoad}
        />
      ))}

      {/* Routes Needing OG Images */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Routes Needing OG Images
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          These routes currently fall back to the default WeWrite branding. Consider adding custom OG images.
        </p>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-2'}>
          {ROUTES_NEEDING_AUDIT.map((route) => (
            <div key={route.path} className="wewrite-card p-4 border-l-4 border-l-orange-500">
              <div className={`flex items-${viewMode === 'grid' ? 'start' : 'center'} justify-between gap-${viewMode === 'grid' ? '2' : '4'}`}>
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
  );
}
