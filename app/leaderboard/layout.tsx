import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards',
  description: 'See the top writers, most viewed pages, and most connected content on WeWrite. Track weekly rankings across various categories.',
  keywords: ['leaderboard', 'top writers', 'rankings', 'most viewed', 'popular writers', 'weekly stats'],
  openGraph: {
    title: 'WeWrite Leaderboards',
    description: 'See the top writers and most popular content on WeWrite.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'WeWrite Leaderboards',
    description: 'See the top writers and most popular content on WeWrite.',
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
