'use client';

import { useAuth } from '../../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from "../../providers/ThemeProvider";
import { useRouter } from 'next/navigation';
import ColorSystemManager from '../../components/settings/ColorSystemManager';
import SolidColorPicker from '../../components/settings/SolidColorPicker';
import PillStyleToggle from '../../components/utils/PillStyleToggle';
import UIStyleToggle from '../../components/utils/UIStyleToggle';
import { Switch } from '../../components/ui/switch';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { usePillStyle, PILL_STYLES, UI_STYLES } from '../../contexts/PillStyleContext';
import { cn } from "../../lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';

export default function AppearancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme, highContrast, toggleHighContrast, reduceAnimations, setReduceAnimations } = useTheme();
  const { accentColor, setAccentColor, getAccentColorValue } = useAccentColor();
  const { pillStyle, uiStyle } = usePillStyle();

  if (!user) {
    return null;
  }

  // Get display labels for current values
  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
      default: return 'System';
    }
  };

  const getPillStyleLabel = () => {
    switch (pillStyle) {
      case PILL_STYLES.FILLED: return 'Filled';
      case PILL_STYLES.OUTLINE: return 'Outlined';
      case PILL_STYLES.TEXT_ONLY: return 'Text only';
      case PILL_STYLES.UNDERLINED: return 'Underlined';
      default: return 'Filled';
    }
  };

  const getUIStyleLabel = () => {
    switch (uiStyle) {
      case UI_STYLES.SHINY: return 'Shiny';
      case UI_STYLES.FLAT: return 'Flat';
      default: return 'Shiny';
    }
  };

  // Theme options with icons
  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      icon: <Icon name="Sun" size={24} />
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Icon name="Moon" size={24} />
    },
    {
      value: 'system',
      label: 'System',
      icon: <Icon name="Laptop" size={24} />
    }
  ];

  return (
    <div className="p-6 lg:p-8" data-page="appearance">
      <div className="space-y-4">
        {/* Theme Selection */}
        <div className="wewrite-card wewrite-card-padding-sm">
          <Accordion type="single" collapsible>
            <AccordionItem value="theme" className="border-none">
              <AccordionTrigger value={getThemeLabel()} className="text-base font-semibold">
                Theme
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      data-theme={option.value}
                      data-active={theme === option.value}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 border rounded-lg transition-[background-color,transform,opacity] duration-200 nav-hover-state outline-none focus:outline-none focus:ring-0",
                        theme === option.value
                          ? "nav-selected-state border-accent"
                          : "border-theme-medium"
                      )}
                    >
                      {option.icon}
                      <div className="font-medium text-sm">{option.label}</div>
                      <Icon
                        name="Check"
                        size={16}
                        className={cn(
                          "text-primary transition-all duration-200",
                          theme === option.value
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-75"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Link Style */}
        <div className="wewrite-card wewrite-card-padding-sm">
          <Accordion type="single" collapsible>
            <AccordionItem value="link-style" className="border-none">
              <AccordionTrigger value={getPillStyleLabel()} className="text-base font-semibold">
                Link Style
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  <PillStyleToggle />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* UI Type */}
        <div className="wewrite-card wewrite-card-padding-sm">
          <Accordion type="single" collapsible>
            <AccordionItem value="ui-type" className="border-none">
              <AccordionTrigger value={getUIStyleLabel()} className="text-base font-semibold">
                UI Type
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  <UIStyleToggle />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Color System */}
        <ColorSystemManager />

        {/* E-Ink Mode */}
        <div className="wewrite-card wewrite-card-padding-sm">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">E-Ink Mode</span>
                {highContrast && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-foreground text-background">
                    On
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Black and white mode with no shadows or accent colors. Great for e-ink readers.
              </p>
            </div>
            <Switch
              checked={highContrast}
              onCheckedChange={toggleHighContrast}
              size="md"
            />
          </div>

          {/* Sub-toggle: Reduce Animations */}
          {highContrast && (
            <div className="flex items-center justify-between py-1 mt-2 pt-2 border-t border-border/40">
              <div className="flex-1 pl-1">
                <span className="text-sm font-medium">Turn off animations</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Disables transitions, hover effects, and loading animations.
                </p>
              </div>
              <Switch
                checked={reduceAnimations}
                onCheckedChange={setReduceAnimations}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
