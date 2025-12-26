import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards',
  description: 'See the top writers, most viewed pages, and most connected content on WeWrite. Track weekly rankings across various categories.',
  keywords: ['leaderboard', 'top writers', 'rankings', 'most viewed', 'popular writers', 'weekly stats'],
  openGraph: {
    title: 'WeWrite Leaderboards',
    description: 'See the top writers and most popular content on WeWrite.',
    type: 'website',
    images: [
      {
        url: 'https://www.getwewrite.app/leaderboard/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'WeWrite Leaderboards'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeWrite Leaderboards',
    description: 'See the top writers and most popular content on WeWrite.',
    images: ['https://www.getwewrite.app/leaderboard/opengraph-image']
  },
  alternates: {
    canonical: 'https://www.getwewrite.app/leaderboard',
  },
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function LeaderboardLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
