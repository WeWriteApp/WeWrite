import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending',
  description: 'Discover trending pages and popular content on WeWrite.',
};

export default function TrendingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
