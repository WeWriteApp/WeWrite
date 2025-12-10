'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useTheme } from "../../providers/ThemeProvider";
import { useRouter } from 'next/navigation';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import ColorSystemManager from '../../components/settings/ColorSystemManager';
import SolidColorPicker from '../../components/settings/SolidColorPicker';
import CardOpacityControl from '../../components/settings/CardOpacityControl';
import PillStyleToggle from '../../components/utils/PillStyleToggle';
import UIStyleToggle from '../../components/utils/UIStyleToggle';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { usePillStyle, PILL_STYLES, UI_STYLES } from '../../contexts/PillStyleContext';
import { cn } from "../../lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';

export default function AppearancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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
                        "flex flex-col items-center gap-2 p-3 border rounded-lg transition-all duration-200 nav-hover-state",
                        theme === option.value
                          ? "nav-selected-state border-accent"
                          : "border-theme-medium"
                      )}
                    >
                      {option.icon}
                      <div className="font-medium text-sm">{option.label}</div>
                      {theme === option.value && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
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
