import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WeWrite - Create New Group',
  description: 'Create a new collaborative writing group',
};

interface NewGroupLayoutProps {
  children: React.ReactNode;
}

export default function NewGroupLayout({ children }: NewGroupLayoutProps) {
  return children;
}
