import React from 'react';
import { OGImageCard } from './OGImageCard';
import type { OGImageType } from '../types';

interface ImageGallerySectionProps {
  title: string;
  dotColor: string;
  items: OGImageType[];
  viewMode: 'grid' | 'list';
  refreshKey: number;
  loadingImages: Record<string, boolean>;
  buildPreviewUrl: (route: string, params: Record<string, string>) => string;
  onImageLoadStart: (id: string) => void;
  onImageLoad: (id: string) => void;
}

export function ImageGallerySection({
  title,
  dotColor,
  items,
  viewMode,
  refreshKey,
  loadingImages,
  buildPreviewUrl,
  onImageLoadStart,
  onImageLoad,
}: ImageGallerySectionProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${dotColor}`} />
        {title}
      </h2>
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
        {items.map((ogType) => (
          <OGImageCard
            key={ogType.id}
            ogType={ogType}
            refreshKey={refreshKey}
            loadingImages={loadingImages}
            viewMode={viewMode}
            buildPreviewUrl={buildPreviewUrl}
            onImageLoadStart={onImageLoadStart}
            onImageLoad={onImageLoad}
          />
        ))}
      </div>
    </div>
  );
}
