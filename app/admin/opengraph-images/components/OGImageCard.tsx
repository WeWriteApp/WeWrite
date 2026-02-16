import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import type { OGImageType } from '../types';

interface OGImageCardProps {
  ogType: OGImageType;
  refreshKey: number;
  loadingImages: Record<string, boolean>;
  viewMode: 'grid' | 'list';
  buildPreviewUrl: (route: string, params: Record<string, string>) => string;
  onImageLoadStart: (id: string) => void;
  onImageLoad: (id: string) => void;
}

export function OGImageCard({ ogType, refreshKey, loadingImages, viewMode, buildPreviewUrl, onImageLoadStart, onImageLoad }: OGImageCardProps) {
  if (viewMode === 'list') {
    return (
      <div className="wewrite-card">
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
            <p className="text-sm font-medium mb-2">Preview (1200x630):</p>
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
                onLoadStart={() => onImageLoadStart(ogType.id)}
                onLoad={() => onImageLoad(ogType.id)}
                onError={() => onImageLoad(ogType.id)}
              />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="wewrite-card p-4">
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
          onLoadStart={() => onImageLoadStart(ogType.id)}
          onLoad={() => onImageLoad(ogType.id)}
          onError={() => onImageLoad(ogType.id)}
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
  );
}
