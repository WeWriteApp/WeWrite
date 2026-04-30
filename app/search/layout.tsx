import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search for pages, users, and content on WeWrite.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
