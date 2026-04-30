import type { Metadata } from 'next';

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: 'WeWrite - Create New Page',
  description: 'Create a new collaborative writing page',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NewPageLayout({ children }: LayoutProps) {
  return children;
}