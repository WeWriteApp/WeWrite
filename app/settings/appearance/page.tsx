'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useTheme } from "../../providers/ThemeProvider";
import { useRouter } from 'next/navigation';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import ColorSystemManager from '../../components/settings/ColorSystemManager';
import SolidColorPicker from '../../components/settings/SolidColorPicker';
import CardOpacityControl from '../../components/settings/CardOpacityControl';
import PillStyleToggle from '../../components/utils/PillStyleToggle';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { cn } from "../../lib/utils";

export default function AppearancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor, getAccentColorValue } = useAccentColor();

  if (!user) {
    return null;
  }

  // Theme options with icons
  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="h-6 w-6" />
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="h-6 w-6" />
    },
    {
      value: 'system',
      label: 'System',
      icon: <Laptop className="h-6 w-6" />
    }
  ];

  return (
    <div className="p-6 lg:p-8" data-page="appearance">
      <div className="space-y-8">
        {/* Theme Selection */}
        <div className="wewrite-card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Theme</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                data-theme={option.value}
                data-active={theme === option.value}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 border rounded-lg transition-all duration-200 nav-hover-state nav-active-state",
                  theme === option.value
                    ? "nav-selected-state border-accent"
                    : "border-theme-medium"
                )}
              >
                {option.icon}
                <div className="font-medium">{option.label}</div>
                {theme === option.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pill Style */}
        <div className="wewrite-card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Link Style</h2>
          </div>

          <PillStyleToggle />
        </div>

        {/* Color System */}
        <ColorSystemManager />

        {/* Card Style */}
        <div className="wewrite-card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Card Style</h2>
          </div>

          <CardOpacityControl />
        </div>
      </div>
    </div>
  );
}