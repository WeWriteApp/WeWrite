import { useState, useCallback } from 'react';

export function useOGImages() {
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleRefreshAll = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleImageLoad = useCallback((id: string) => {
    setLoadingImages(prev => ({ ...prev, [id]: false }));
  }, []);

  const handleImageLoadStart = useCallback((id: string) => {
    setLoadingImages(prev => ({ ...prev, [id]: true }));
  }, []);

  const buildPreviewUrl = useCallback((route: string, params: Record<string, string>): string => {
    if (Object.keys(params).length === 0) {
      return `${route}?t=${Date.now()}`;
    }
    const searchParams = new URLSearchParams(params);
    return `${route}?${searchParams.toString()}&t=${Date.now()}`;
  }, []);

  return {
    loadingImages,
    refreshKey,
    viewMode,
    setViewMode,
    handleRefreshAll,
    handleImageLoad,
    handleImageLoadStart,
    buildPreviewUrl,
  };
}
