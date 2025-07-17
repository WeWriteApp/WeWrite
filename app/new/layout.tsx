import type { Metadata } from 'next';

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: 'WeWrite - Create New Page',
  description: 'Create a new collaborative writing page'
};

export default function NewPageLayout({ children }: LayoutProps) {
  return children;
}