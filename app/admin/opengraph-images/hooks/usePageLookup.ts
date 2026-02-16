import { useState, useCallback } from 'react';

export function usePageLookup() {
  const [lookupPageId, setLookupPageId] = useState('');
  const [lookupPageData, setLookupPageData] = useState<any | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

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

  const buildLookupPreviewUrl = useCallback((route: string): string => {
    if (!lookupPageData) {
      return route;
    }

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

  return {
    lookupPageId,
    setLookupPageId,
    lookupPageData,
    isLookingUp,
    handleLookupPage,
    handleClearLookup,
    buildLookupPreviewUrl,
  };
}
