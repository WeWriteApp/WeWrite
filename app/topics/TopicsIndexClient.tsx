"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';

interface Topic {
  topic: string;
  slug: string;
  displayName: string;
  pageCount: number;
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

export default function TopicsIndexClient() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/topics');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load topics');
        }

        setTopics(data.topics || []);
      } catch (err) {
        console.error('Error fetching topics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load topics');
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore Topics</h1>
        <p className="text-muted-foreground">
          Discover content by topic from our community of writers
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Icon name="Loader" size={32} className="mb-4" />
            <p className="text-muted-foreground">Loading topics...</p>
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
      ) : topics.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="FolderOpen" size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No topics with content yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/topics/${topic.slug}`}
              className="group flex flex-col items-center p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary mb-3 group-hover:bg-primary/20 transition-colors">
                <Icon
                  name={topicIcons[topic.slug] as any || 'Hash'}
                  size={24}
                />
              </div>
              <h2 className="font-medium text-center mb-1">{topic.displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {topic.pageCount} {topic.pageCount === 1 ? 'page' : 'pages'}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* SEO: Structured data for topic list */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Explore Topics on WeWrite",
            "description": "Discover content by topic from our community of writers",
            "url": "https://www.getwewrite.app/topics",
            "hasPart": topics.map(topic => ({
              "@type": "WebPage",
              "name": topic.displayName,
              "url": `https://www.getwewrite.app/topics/${topic.slug}`
            }))
          })
        }}
      />
    </div>
  );
}
