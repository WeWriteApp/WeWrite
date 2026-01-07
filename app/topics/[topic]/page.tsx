import type { Metadata } from 'next';
import TopicPageClient from './TopicPageClient';

// Generate static params for common topics
export async function generateStaticParams() {
  const topics = [
    'technology', 'writing', 'creativity', 'business', 'personal',
    'tutorial', 'philosophy', 'science', 'art', 'music',
    'travel', 'food', 'health', 'education', 'finance',
    'lifestyle', 'productivity', 'programming', 'design', 'marketing'
  ];

  return topics.map((topic) => ({
    topic: topic,
  }));
}

// Generate metadata for each topic page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const displayName = topic.charAt(0).toUpperCase() + topic.slice(1);
  const canonicalUrl = `https://www.getwewrite.app/topics/${topic}`;

  return {
    title: `${displayName} Articles`,
    description: `Discover ${displayName.toLowerCase()} articles and content on WeWrite. Read insights, tutorials, and stories from our community of writers about ${displayName.toLowerCase()}.`,
    keywords: [topic, `${topic} articles`, `${topic} writing`, `${topic} content`, 'wewrite'],
    openGraph: {
      title: `${displayName} Articles on WeWrite`,
      description: `Discover ${displayName.toLowerCase()} articles and content from our community of writers.`,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary',
      title: `${displayName} Articles on WeWrite`,
      description: `Discover ${displayName.toLowerCase()} articles and content from our community of writers.`,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  return <TopicPageClient topic={topic} />;
}
