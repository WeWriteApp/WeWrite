import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WeWrite - Groups',
  description: 'View and manage your collaborative writing groups',
};

interface GroupLayoutProps {
  children: React.ReactNode;
}

export default function GroupLayout({ children }: GroupLayoutProps) {
  return children;
}
