"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';

interface FeaturedPage {
  id: string;
  title: string;
  username: string;
  userId: string;
  lastModified: string;
  viewCount: number;
  sponsorCount: number;
  backlinkCount: number;
  excerpt: string;
  score: number;
}

type Category = 'all' | 'most-viewed' | 'most-supported' | 'most-linked';

export default function FeaturedPageClient() {
  const [pages, setPages] = useState<FeaturedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('all');

  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoading(true);
        const url = category === 'all'
          ? '/api/featured?limit=30'
          : `/api/featured?limit=30&category=${category}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load featured content');
        }

        setPages(data.pages || []);
      } catch (err) {
        console.error('Error fetching featured pages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load featured content');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [category]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const categories: { value: Category; label: string; icon: string }[] = [
    { value: 'all', label: 'Best Overall', icon: 'Award' },
    { value: 'most-viewed', label: 'Most Viewed', icon: 'Eye' },
    { value: 'most-supported', label: 'Most Supported', icon: 'Heart' },
    { value: 'most-linked', label: 'Most Linked', icon: 'Link' },
  ];

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Icon name="Award" size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-2">Featured Content</h1>
        <p className="text-muted-foreground">
          Discover the best writing from our community
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            <Icon name={cat.icon as any} size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Icon name="Loader2" size={32} className="animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading featured content...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-sm bg-muted/50 dark:bg-muted/30 text-primary dark:text-muted-foreground rounded-lg">
          <p>{error}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="FileQuestion" size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No featured content found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map((page, index) => (
            <article
              key={page.id}
              className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
            >
              <Link href={`/${page.id}`} className="block p-5">
                <div className="flex items-start gap-4">
                  {/* Rank badge for top 3 */}
                  {index < 3 && category === 'all' && (
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-amber-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      'bg-amber-700 text-white'
                    }`}>
                      {index + 1}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-medium mb-1 group-hover:text-primary transition-colors">
                      {page.title || 'Untitled'}
                    </h2>
                    {page.excerpt && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                        {page.excerpt}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="User" size={14} />
                        {page.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={14} />
                        {page.viewCount.toLocaleString()} views
                      </span>
                      {page.sponsorCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Icon name="Heart" size={14} />
                          {page.sponsorCount} supporters
                        </span>
                      )}
                      {page.backlinkCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon name="Link" size={14} />
                          {page.backlinkCount} links
                        </span>
                      )}
                    </div>
                  </div>

                  <Icon
                    name="ChevronRight"
                    size={20}
                    className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"
                  />
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* SEO: Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Featured Content on WeWrite",
            "description": "Discover the best content on WeWrite. Explore highly-rated articles and popular writing.",
            "url": "https://www.getwewrite.app/featured",
            "mainEntity": {
              "@type": "ItemList",
              "numberOfItems": pages.length,
              "itemListElement": pages.slice(0, 10).map((page, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "url": `https://www.getwewrite.app/${page.id}`,
                "name": page.title
              }))
            }
          })
        }}
      />
    </div>
  );
}
