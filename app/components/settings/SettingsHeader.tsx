'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { ChevronLeft, X } from 'lucide-react';

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
      {/* Mobile Header - Always visible on mobile */}
      <div className="lg:hidden sticky top-0 z-50 wewrite-card wewrite-card-sharp wewrite-card-border-bottom wewrite-card-no-padding" data-component="main-header">
        <div className="flex items-center justify-between h-14 px-4">
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
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/settings')}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Back to Settings"
              >
                <ChevronLeft className="h-5 w-5" />
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
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: No header needed since we have sidebar context */}
    </>
  );
}
