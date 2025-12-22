import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'View your notifications and updates on WeWrite.',
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
