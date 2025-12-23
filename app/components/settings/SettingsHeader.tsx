'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';

interface SettingsHeaderProps {
  title?: string;
}

export default function SettingsHeader({ title }: SettingsHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Get the page title based on the current path
  const getPageTitle = () => {
    if (title) return title;

    switch (pathname) {
      case '/settings':
        return 'Settings';
      case '/settings/profile':
        return 'Profile';
      case '/settings/fund-account':
        return 'Fund Account';
      case '/settings/spend':
        return 'Manage Spending';
      case '/settings/earnings':
        return 'Get Paid';
      case '/settings/appearance':
        return 'Appearance';
      case '/settings/deleted':
        return 'Recently Deleted';
      case '/settings/advanced':
        return 'Advanced';
      default:
        return 'Settings';
    }
  };

  const pageTitle = getPageTitle();
  const isMainSettings = pathname === '/settings';

  return (
    <>
      {/* Mobile Header - Normal static header */}
      <header className="lg:hidden border-b-subtle bg-background px-4 py-3 flex items-center justify-between">
        {/* Left: Back button */}
        <div className="flex items-center">
          {isMainSettings ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to Home"
            >
              <Icon name="ChevronLeft" size={20} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/settings')}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to Settings"
            >
              <Icon name="ChevronLeft" size={20} />
            </Button>
          )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
        </div>

        {/* Right: Close button */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close Settings"
          >
            <Icon name="X" size={20} />
          </Button>
        </div>
      </header>

      {/* Desktop: No header needed since we have sidebar context */}
    </>
  );
}
