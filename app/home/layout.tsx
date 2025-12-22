import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Your personalized feed of content from people you follow on WeWrite.',
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
