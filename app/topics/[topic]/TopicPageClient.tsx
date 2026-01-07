"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import PillLink from '../../components/utils/PillLink';

interface TopicPage {
  id: string;
  title: string;
  username: string;
  userId: string;
  lastModified: string;
  viewCount: number;
  excerpt: string;
}

interface TopicPageClientProps {
  topic: string;
}

// Topic icons mapping
const topicIcons: Record<string, string> = {
  technology: 'Cpu',
  writing: 'PenLine',
  creativity: 'Lightbulb',
  business: 'Briefcase',
  personal: 'User',
  tutorial: 'GraduationCap',
  philosophy: 'Brain',
  science: 'FlaskConical',
  art: 'Palette',
  music: 'Music',
  travel: 'Plane',
  food: 'UtensilsCrossed',
  health: 'Heart',
  education: 'BookOpen',
  finance: 'DollarSign',
  lifestyle: 'Sparkles',
  productivity: 'Target',
  programming: 'Code',
  design: 'Figma',
  marketing: 'Megaphone'
};

export default function TopicPageClient({ topic }: TopicPageClientProps) {
  const [pages, setPages] = useState<TopicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = topic.charAt(0).toUpperCase() + topic.slice(1);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/topics?topic=${encodeURIComponent(topic)}&limit=30`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load pages');
        }

        setPages(data.pages || []);
      } catch (err) {
        console.error('Error fetching topic pages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pages');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [topic]);

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

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/topics" className="hover:text-foreground">Topics</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{displayName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon
            name={topicIcons[topic] as any || 'Hash'}
            size={32}
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${pages.length} articles`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Icon name="Loader2" size={32} className="animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading {displayName.toLowerCase()} articles...</p>
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
          <p className="text-muted-foreground mb-4">
            No {displayName.toLowerCase()} articles found yet
          </p>
          <Link
            href="/topics"
            className="text-primary hover:underline"
          >
            Browse other topics
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map((page) => (
            <article
              key={page.id}
              className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
            >
              <Link href={`/${page.id}`} className="block p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-medium mb-1 group-hover:text-primary transition-colors">
                      {page.title || 'Untitled'}
                    </h2>
                    {page.excerpt && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                        {page.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="User" size={14} />
                        {page.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Calendar" size={14} />
                        {formatDate(page.lastModified)}
                      </span>
                      {page.viewCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon name="Eye" size={14} />
                          {page.viewCount.toLocaleString()}
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
            "name": `${displayName} Articles on WeWrite`,
            "description": `Discover ${displayName.toLowerCase()} articles and content from our community of writers.`,
            "url": `https://www.getwewrite.app/topics/${topic}`,
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "WeWrite",
                  "item": "https://www.getwewrite.app"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Topics",
                  "item": "https://www.getwewrite.app/topics"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": displayName,
                  "item": `https://www.getwewrite.app/topics/${topic}`
                }
              ]
            },
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
