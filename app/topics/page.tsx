import type { Metadata } from 'next';
import TopicsIndexClient from './TopicsIndexClient';

export const metadata: Metadata = {
  title: 'Explore Topics',
  description: 'Discover content by topic on WeWrite. Browse articles about technology, writing, creativity, business, and more from our community of writers.',
  keywords: ['topics', 'categories', 'explore', 'discover', 'writing topics', 'content categories'],
  openGraph: {
    title: 'Explore Topics on WeWrite',
    description: 'Discover content by topic. Browse articles about technology, writing, creativity, business, and more.',
    type: 'website',
    url: 'https://www.getwewrite.app/topics',
  },
  twitter: {
    card: 'summary',
    title: 'Explore Topics on WeWrite',
    description: 'Discover content by topic. Browse articles about technology, writing, creativity, business, and more.',
  },
  alternates: {
    canonical: 'https://www.getwewrite.app/topics',
  },
};

export default function TopicsPage() {
  return <TopicsIndexClient />;
}
