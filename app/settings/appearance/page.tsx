'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useTheme } from "../../providers/ThemeProvider";
import { useRouter } from 'next/navigation';
import { Button } from "../../components/ui/button";
import { ChevronLeft, Sun, Moon, Laptop, Check } from 'lucide-react';
import AccentColorSwitcher from '../../components/utils/AccentColorSwitcher';
import PillStyleToggle from '../../components/utils/PillStyleToggle';
import { cn } from "../../lib/utils";
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';

export default function AppearancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (!user) {
    return null;
  }

  // Theme options with icons
  const themeOptions = [
    { 
      value: 'light', 
      label: 'Light', 
      icon: <Sun className="h-4 w-4 mr-2" />,
      description: 'Light theme for bright environments'
    },
    { 
      value: 'dark', 
      label: 'Dark', 
      icon: <Moon className="h-4 w-4 mr-2" />,
      description: 'Dark theme for low-light environments'
    },
    { 
      value: 'system', 
      label: 'System', 
      icon: <Laptop className="h-4 w-4 mr-2" />,
      description: 'Automatically match your system preference'
    }
  ];

  return (
    <div>
      <SettingsPageHeader
        title="Appearance"
        description="Customize the look and feel of WeWrite"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

        <div className="space-y-8">
          {/* Theme Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Theme</h2>
              <p className="text-muted-foreground text-sm">
                Choose how WeWrite looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes.
              </p>
            </div>
            
            <div className="grid gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex items-center justify-between p-4 text-left border rounded-lg transition-colors",
                    "hover:bg-muted/50",
                    theme === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border"
                  )}
                >
                  <div className="flex items-center">
                    {option.icon}
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </div>
                  {theme === option.value && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Accent Color</h2>
              <p className="text-muted-foreground text-sm">
                Choose an accent color to personalize your WeWrite experience.
              </p>
            </div>
            
            <AccentColorSwitcher />
          </div>

          {/* Pill Style */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Link Style</h2>
              <p className="text-muted-foreground text-sm">
                Customize how page links appear throughout WeWrite.
              </p>
            </div>
            
            <PillStyleToggle />
          </div>
        </div>
      </div>
    </div>
  );
}