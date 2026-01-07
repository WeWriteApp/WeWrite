import type { Metadata } from 'next';
import FeaturedPageClient from './FeaturedPageClient';

export const metadata: Metadata = {
  title: 'Featured Content',
  description: 'Discover the best content on WeWrite. Explore highly-rated articles, popular writing, and top-supported content from our community of writers.',
  keywords: ['featured', 'best content', 'popular articles', 'top writers', 'recommended reading'],
  openGraph: {
    title: 'Featured Content on WeWrite',
    description: 'Discover the best content on WeWrite. Explore highly-rated articles and popular writing.',
    type: 'website',
    url: 'https://www.getwewrite.app/featured',
  },
  twitter: {
    card: 'summary',
    title: 'Featured Content on WeWrite',
    description: 'Discover the best content on WeWrite. Explore highly-rated articles and popular writing.',
  },
  alternates: {
    canonical: 'https://www.getwewrite.app/featured',
  },
};

export default function FeaturedPage() {
  return <FeaturedPageClient />;
}
