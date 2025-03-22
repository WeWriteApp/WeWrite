import React, { useContext } from 'react';
import { X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { Switch } from './switch';
import { Label } from './label';
import { SheetContent, SheetHeader, SheetTitle, SheetClose } from './sheet';
import { AuthContext } from '../../providers/AuthProvider';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const handleLogout = () => {
    // Logic to handle logout
    // This would typically call your auth service
    // For now, we'll just redirect to the home page
    router.push('/');
  };

  return (
    <SheetContent side="right" className={`p-0 ${className || ''}`}>
      <div className="flex flex-col h-full bg-background text-foreground">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">WeWrite</SheetTitle>
            <SheetClose asChild>
              <button className="rounded-full p-1 hover:bg-accent/50">
                <X className="h-5 w-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 p-4 space-y-6">
          {/* Theme Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Theme</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2" />
                      <path d="M12 20v2" />
                      <path d="M4.93 4.93l1.41 1.41" />
                      <path d="M17.66 17.66l1.41 1.41" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="M6.34 17.66l-1.41 1.41" />
                      <path d="M19.07 4.93l-1.41 1.41" />
                    </svg>
                  </div>
                  <span>Light</span>
                </div>
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    id="light-theme"
                    name="theme"
                    className="rounded-full"
                    checked={theme === 'light'}
                    onChange={() => setTheme('light')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                    </svg>
                  </div>
                  <span>Dark</span>
                </div>
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    id="dark-theme"
                    name="theme"
                    className="rounded-full"
                    checked={theme === 'dark'}
                    onChange={() => setTheme('dark')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <rect width="20" height="14" x="2" y="3" rx="2" />
                      <line x1="8" x2="16" y1="21" y2="21" />
                      <line x1="12" x2="12" y1="17" y2="21" />
                    </svg>
                  </div>
                  <span>System</span>
                </div>
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    id="system-theme"
                    name="theme"
                    className="rounded-full"
                    checked={theme === 'system'}
                    onChange={() => setTheme('system')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-auto pt-4 border-t border-border" data-component-name="Sidebar">
          {user && (
            <div className="px-4 pb-2 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.username || user.email || 'Anonymous'}</span>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 mb-2"
            onClick={() => router.push('/account')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Account
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-destructive">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span data-component-name="Sidebar">Log out</span>
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}
