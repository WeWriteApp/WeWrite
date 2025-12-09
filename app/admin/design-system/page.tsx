"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import {
  ChevronLeft,
  Palette,
  Search,
  Heart,
  Star,
  Settings,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Check,
  X,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { isAdmin } from '../../utils/isAdmin';
import ColorSystemManager from '@/components/settings/ColorSystemManager';
import ThemeToggle from '@/components/utils/ThemeToggle';
import VerifyEmailBanner from '../../components/utils/VerifyEmailBanner';
import PWABanner from '../../components/utils/PWABanner';
import PillLink from '../../components/utils/PillLink';
import { InlineError } from '../../components/ui/InlineError';
import { UsernameBadge } from '../../components/ui/UsernameBadge';

interface ComponentShowcaseProps {
  title: string;
  path: string;
  description: string;
  children: React.ReactNode;
}

function ComponentShowcase({ title, path, description, children }: ComponentShowcaseProps) {
  return (
    <div className="wewrite-card space-y-4">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{path}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function StateDemo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="flex flex-wrap gap-2 items-center">
        {children}
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center text-primary hover:text-primary/80">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Link>
          <div className="flex items-center gap-3 mt-4 mb-2">
            <Palette className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">WeWrite Design System</h1>
          </div>
          <p className="text-muted-foreground">
            Interactive showcase of all WeWrite components with their states and documentation
          </p>
        </div>

        <div className="space-y-8">
          {/* Color System Controls */}
          <div className="wewrite-card space-y-4">
            <div className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Color System Controls</h3>
                  <p className="text-sm text-muted-foreground">app/components/settings/ColorSystemManager.tsx</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adjust accent, neutral, and background colors to test how all components look with different color schemes
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">Theme:</div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <ColorSystemManager />
            </div>
          </div>

          {/* Color Token Documentation */}
          <div className="wewrite-card space-y-4">
            <div className="border-b border-border pb-4">
              <h3 className="text-lg font-semibold">Color Token Reference</h3>
              <p className="text-sm text-muted-foreground">app/globals.css</p>
              <p className="text-sm text-muted-foreground mt-1">
                How to use color tokens in Tailwind classes throughout the codebase
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Primary/Accent Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Primary (Accent) Colors</h4>
                <p className="text-sm text-muted-foreground">
                  The primary color is used for interactive elements, links, and emphasis. Use opacity variants for subtle fills.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">primary</div>
                    <code className="text-muted-foreground">bg-primary</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary-20 rounded flex items-center justify-center">primary-20</div>
                    <code className="text-muted-foreground">bg-primary-20</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary-10 rounded flex items-center justify-center">primary-10</div>
                    <code className="text-muted-foreground">bg-primary-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary-5 rounded flex items-center justify-center">primary-5</div>
                    <code className="text-muted-foreground">bg-primary-5</code>
                  </div>
                </div>
              </div>

              {/* Neutral Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Neutral Colors</h4>
                <p className="text-sm text-muted-foreground">
                  Neutral colors are derived from the primary hue with low chroma. Use for backgrounds, borders, and secondary UI elements.
                  <strong className="text-foreground"> The number represents opacity percentage.</strong>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-30 rounded flex items-center justify-center">30%</div>
                    <code className="text-muted-foreground">bg-neutral-30</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-20 rounded flex items-center justify-center">20%</div>
                    <code className="text-muted-foreground">bg-neutral-20</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-15 rounded flex items-center justify-center">15%</div>
                    <code className="text-muted-foreground">bg-neutral-15</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-10 rounded flex items-center justify-center">10%</div>
                    <code className="text-muted-foreground">bg-neutral-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-5 rounded flex items-center justify-center">5%</div>
                    <code className="text-muted-foreground">bg-neutral-5</code>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Usage:</strong> <code className="bg-muted px-1 rounded">bg-neutral-5</code> for very subtle fills, 
                  <code className="bg-muted px-1 rounded ml-1">bg-neutral-10</code> for hover states, 
                  <code className="bg-muted px-1 rounded ml-1">border-neutral-20</code> for borders.
                </p>
              </div>

              {/* Semantic Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Semantic Colors</h4>
                <p className="text-sm text-muted-foreground">
                  Success and error colors with opacity variants for backgrounds and subtle fills.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-success rounded flex items-center justify-center text-white">success</div>
                    <code className="text-muted-foreground">bg-success</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-success-10 rounded flex items-center justify-center text-success">success-10</div>
                    <code className="text-muted-foreground">bg-success-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-error rounded flex items-center justify-center text-white">error</div>
                    <code className="text-muted-foreground">bg-error</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-error-10 rounded flex items-center justify-center text-error">error-10</div>
                    <code className="text-muted-foreground">bg-error-10</code>
                  </div>
                </div>
              </div>

              {/* Alpha Overlay Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Alpha Overlay Colors ✨</h4>
                <p className="text-sm text-muted-foreground">
                  Alpha colors are <strong className="text-foreground">theme-aware overlays</strong> that automatically adapt to light/dark mode.
                  In light mode they use black (to darken), in dark mode they use white (to brighten).
                  <strong className="text-foreground"> Use these for hover/active states on any background color.</strong>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground relative overflow-hidden">
                      <div className="absolute inset-0 bg-alpha-5"></div>
                      <span className="relative">+5%</span>
                    </div>
                    <code className="text-muted-foreground">alpha-5</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground relative overflow-hidden">
                      <div className="absolute inset-0 bg-alpha-10"></div>
                      <span className="relative">+10%</span>
                    </div>
                    <code className="text-muted-foreground">alpha-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground relative overflow-hidden">
                      <div className="absolute inset-0 bg-alpha-15"></div>
                      <span className="relative">+15%</span>
                    </div>
                    <code className="text-muted-foreground">alpha-15</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground relative overflow-hidden">
                      <div className="absolute inset-0 bg-alpha-20"></div>
                      <span className="relative">+20%</span>
                    </div>
                    <code className="text-muted-foreground">alpha-20</code>
                  </div>
                </div>
              </div>

              {/* Semantic Alpha Overlays */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Semantic Alpha Overlays</h4>
                <p className="text-sm text-muted-foreground">
                  Color-matched overlays for success and error buttons. Creates a tinted hover effect that matches the button's color
                  instead of just darkening/brightening.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-success-10 rounded flex items-center justify-center text-success relative overflow-hidden">
                      <span className="relative">success-10</span>
                    </div>
                    <code className="text-muted-foreground">base</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-success-10 rounded flex items-center justify-center text-success relative overflow-hidden" style={{backgroundImage: 'linear-gradient(var(--success-alpha-10), var(--success-alpha-10))'}}>
                      <span className="relative">+hover</span>
                    </div>
                    <code className="text-muted-foreground">success-alpha-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-error-10 rounded flex items-center justify-center text-error relative overflow-hidden">
                      <span className="relative">error-10</span>
                    </div>
                    <code className="text-muted-foreground">base</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-error-10 rounded flex items-center justify-center text-error relative overflow-hidden" style={{backgroundImage: 'linear-gradient(var(--error-alpha-10), var(--error-alpha-10))'}}>
                      <span className="relative">+hover</span>
                    </div>
                    <code className="text-muted-foreground">error-alpha-10</code>
                  </div>
                </div>
                <div className="wewrite-card p-4 bg-muted/30 mt-3">
                  <p className="text-sm mb-2"><strong>Usage:</strong></p>
                  <code className="text-sm block mb-2">hover:success-alpha-10 active:success-alpha-15</code>
                  <code className="text-sm block">hover:error-alpha-10 active:error-alpha-15</code>
                </div>
              </div>

              {/* Usage Patterns */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Common Patterns</h4>
                <div className="wewrite-card p-4 space-y-3 bg-muted/30">
                  <div className="text-sm space-y-2">
                    <p><strong>Solid buttons (primary/success/error):</strong> <code className="bg-muted px-1 rounded">bg-primary hover:alpha-10 active:alpha-15</code></p>
                    <p><strong>Secondary buttons:</strong> <code className="bg-muted px-1 rounded">bg-neutral-5 hover:alpha-10 active:alpha-15</code></p>
                    <p><strong>Outline buttons:</strong> <code className="bg-muted px-1 rounded">border border-neutral-20 hover:bg-alpha-5</code></p>
                    <p><strong>Ghost buttons:</strong> <code className="bg-muted px-1 rounded">hover:bg-alpha-5 active:bg-alpha-10</code></p>
                    <p><strong>Cards:</strong> <code className="bg-muted px-1 rounded">bg-muted/50 border border-border</code></p>
                    <p><strong>Active chips:</strong> <code className="bg-muted px-1 rounded">bg-primary-10 text-primary</code></p>
                    <p><strong>Inactive chips:</strong> <code className="bg-muted px-1 rounded">bg-neutral-5 text-foreground</code></p>
                    <p><strong>Success-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-success-10 hover:success-alpha-10</code></p>
                    <p><strong>Destructive-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-error-10 hover:error-alpha-10</code></p>
                  </div>
                </div>
              </div>

              {/* Card & Background System */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Card & Background System</h4>
                <p className="text-sm text-muted-foreground">
                  Use the <strong className="text-foreground">bg-card</strong> color for card backgrounds and glassmorphic headers.
                  This is <strong className="text-error">NOT the same as neutral-alpha</strong> which creates overlays, not backgrounds.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-success">Correct: bg-card</p>
                    <div className="h-16 bg-card/80 backdrop-blur-md rounded-lg border border-border/50 flex items-center justify-center text-sm">
                      Light in light mode, dark in dark mode
                    </div>
                    <code className="text-xs text-muted-foreground">bg-card/80 backdrop-blur-md border-border/50</code>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-error">Wrong: bg-neutral-alpha-70</p>
                    <div className="h-16 bg-neutral-alpha-70 backdrop-blur-md rounded-lg border border-neutral-alpha-10 flex items-center justify-center text-sm">
                      Dark in light mode, light in dark mode
                    </div>
                    <code className="text-xs text-muted-foreground">bg-neutral-alpha-70 (INVERTED!)</code>
                  </div>
                </div>
                <div className="wewrite-card p-4 bg-muted/30 mt-3 space-y-2">
                  <p className="text-sm"><strong>When to use what:</strong></p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li><code className="bg-muted px-1 rounded">bg-card</code> - Card backgrounds, headers, floating elements</li>
                    <li><code className="bg-muted px-1 rounded">bg-card/80</code> - Glassmorphic headers with backdrop-blur</li>
                    <li><code className="bg-muted px-1 rounded">bg-background</code> - Page backgrounds</li>
                    <li><code className="bg-muted px-1 rounded">bg-neutral-alpha-*</code> - <strong className="text-error">ONLY for overlay effects</strong> (hover states, darkening/brightening)</li>
                  </ul>
                </div>
              </div>

              {/* Neutral Alpha System */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Neutral Alpha System</h4>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Theme-aware neutral overlays</strong> that automatically adapt to light/dark mode.
                  Black overlays in light mode (to darken), white overlays in dark mode (to brighten).
                  Available as <code className="bg-muted px-1 rounded">bg-</code>, <code className="bg-muted px-1 rounded">text-</code>, and <code className="bg-muted px-1 rounded">border-</code> utilities.
                </p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-5 rounded flex items-center justify-center">5</div>
                    <code className="text-muted-foreground">neutral-alpha-5</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-10 rounded flex items-center justify-center">10</div>
                    <code className="text-muted-foreground">neutral-alpha-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-15 rounded flex items-center justify-center">15</div>
                    <code className="text-muted-foreground">neutral-alpha-15</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-20 rounded flex items-center justify-center">20</div>
                    <code className="text-muted-foreground">neutral-alpha-20</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-30 rounded flex items-center justify-center">30</div>
                    <code className="text-muted-foreground">neutral-alpha-30</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-50 rounded flex items-center justify-center">50</div>
                    <code className="text-muted-foreground">neutral-alpha-50</code>
                  </div>
                </div>
                <div className="wewrite-card p-4 bg-muted/30 mt-3">
                  <p className="text-sm mb-2"><strong>Usage Examples:</strong></p>
                  <code className="text-sm block mb-1">bg-neutral-alpha-15 {/* subtle overlay backgrounds */}</code>
                  <code className="text-sm block mb-1">text-neutral-alpha-60 {/* muted text */}</code>
                  <code className="text-sm block">border-neutral-alpha-20 {/* subtle borders */}</code>
                </div>
              </div>

              {/* Alpha vs Opacity Note */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Alpha vs Opacity: When to Use Which</h4>
                <div className="wewrite-card p-4 bg-muted/30">
                  <div className="text-sm space-y-3">
                    <div>
                      <p className="font-medium">Use <code className="bg-muted px-1 rounded">neutral-alpha-*</code> for theme-aware overlays:</p>
                      <p className="text-muted-foreground text-xs mt-1">Darkens in light mode (black), brightens in dark mode (white). Perfect for hover states on colorful backgrounds.</p>
                    </div>
                    <div>
                      <p className="font-medium">Use <code className="bg-muted px-1 rounded">success-alpha-*</code> / <code className="bg-muted px-1 rounded">error-alpha-*</code> for semantic buttons:</p>
                      <p className="text-muted-foreground text-xs mt-1">Color-matched tint for success-secondary and destructive-secondary buttons.</p>
                    </div>
                    <div>
                      <p className="font-medium">Use <code className="bg-muted px-1 rounded">accent-{'{N}'}</code> / <code className="bg-muted px-1 rounded">neutral-{'{N}'}</code> for tinted fills:</p>
                      <p className="text-muted-foreground text-xs mt-1">Opacity of the accent/neutral color itself. Good for chips, tags, subtle fills.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <ComponentShowcase
            title="Button"
            path="app/components/ui/button.tsx"
            description="Primary interactive element with multiple variants and states"
          >
            <StateDemo label="Primary Variants">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </StateDemo>

            <StateDemo label="Destructive Variants">
              <Button variant="destructive">Destructive</Button>
              <Button variant="destructive-secondary">Destructive Secondary</Button>
              <Button variant="destructive-ghost">Destructive Ghost</Button>
            </StateDemo>

            <StateDemo label="Success Variants">
              <Button variant="success">Success</Button>
              <Button variant="success-secondary">Success Secondary</Button>
              <Button variant="success-ghost">Success Ghost</Button>
            </StateDemo>
            
            <StateDemo label="Sizes">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </StateDemo>

            <StateDemo label="Icon Sizes">
              <Button size="icon-sm"><Settings /></Button>
              <Button size="icon"><Settings /></Button>
              <Button size="icon-lg"><Settings /></Button>
            </StateDemo>
            
            <StateDemo label="States">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button onClick={handleLoadingDemo} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Loading...' : 'Click for Loading'}
              </Button>
            </StateDemo>
            
            <StateDemo label="With Icons">
              <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
              <Button variant="secondary"><Search className="mr-2 h-4 w-4" />Search</Button>
              <Button variant="success"><Check className="mr-2 h-4 w-4" />Save</Button>
              <Button variant="destructive"><X className="mr-2 h-4 w-4" />Delete</Button>
              <Button variant="success-secondary"><Check className="mr-2 h-4 w-4" />Approve</Button>
              <Button variant="destructive-ghost"><X className="mr-2 h-4 w-4" />Remove</Button>
            </StateDemo>
          </ComponentShowcase>

          {/* Icon Buttons */}
          <ComponentShowcase
            title="IconButton"
            path="app/components/ui/icon-button.tsx"
            description="Wrapper around Button with icon size as default. Inherits all Button variants and styling."
          >
            <StateDemo label="All Variants (icon-only)">
              <IconButton variant="default"><Settings /></IconButton>
              <IconButton variant="secondary"><Search /></IconButton>
              <IconButton variant="outline"><User /></IconButton>
              <IconButton variant="ghost"><Heart /></IconButton>
              <IconButton variant="destructive"><X /></IconButton>
              <IconButton variant="destructive-secondary"><X /></IconButton>
              <IconButton variant="success"><Check /></IconButton>
              <IconButton variant="success-secondary"><Check /></IconButton>
            </StateDemo>

            <StateDemo label="Sizes">
              <IconButton size="icon-sm"><Settings /></IconButton>
              <IconButton size="icon"><Settings /></IconButton>
              <IconButton size="icon-lg"><Settings /></IconButton>
            </StateDemo>

            <StateDemo label="States">
              <IconButton><Settings /></IconButton>
              <IconButton disabled><Settings /></IconButton>
            </StateDemo>

            <StateDemo label="Implementation Note">
              <div className="wewrite-card p-3 text-sm text-muted-foreground">
                <code className="bg-muted px-1 rounded">IconButton</code> is now a thin wrapper around <code className="bg-muted px-1 rounded">Button</code> with <code className="bg-muted px-1 rounded">size="icon"</code> as default.
                All styling improvements to Button automatically apply to IconButton.
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Inputs */}
          <ComponentShowcase
            title="Input"
            path="app/components/ui/input.tsx"
            description="Glassmorphic text input with focus states and validation"
          >
            <StateDemo label="Basic Input">
              <Input 
                placeholder="Enter text..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-64"
              />
            </StateDemo>
            
            <StateDemo label="Input Types">
              <Input type="email" placeholder="Email address" className="w-64" />
              <Input type="password" placeholder="Password" className="w-64" />
              <Input type="search" placeholder="Search..." className="w-64" />
            </StateDemo>
            
            <StateDemo label="States">
              <Input placeholder="Normal" className="w-64" />
              <Input placeholder="Disabled" disabled className="w-64" />
              <Input placeholder="With value" value="Sample text" readOnly className="w-64" />
            </StateDemo>
            
            <StateDemo label="With Icons">
              <div className="relative w-64">
                <Input placeholder="Search..." className="wewrite-input-with-left-icon" />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <div className="relative w-64">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="wewrite-input-with-right-icon"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Textarea */}
          <ComponentShowcase
            title="Textarea"
            path="app/components/ui/textarea.tsx"
            description="Multi-line glassmorphic text input with resize capabilities"
          >
            <StateDemo label="Basic Textarea">
              <Textarea 
                placeholder="Enter your message..." 
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                className="w-full max-w-md"
                rows={4}
              />
            </StateDemo>
            
            <StateDemo label="States">
              <Textarea placeholder="Normal" className="w-full max-w-md" rows={3} />
              <Textarea placeholder="Disabled" disabled className="w-full max-w-md" rows={3} />
              <Textarea 
                placeholder="With content" 
                value="This is sample content in a textarea that demonstrates how text wraps and displays."
                readOnly 
                className="w-full max-w-md" 
                rows={3} 
              />
            </StateDemo>
          </ComponentShowcase>

          {/* Cards */}
          <ComponentShowcase
            title="Card"
            path="app/components/ui/card.tsx"
            description="Glassmorphic container with header, content, and footer sections"
          >
            <StateDemo label="Basic Card">
              <Card className="w-80">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>This is a card description that explains the content.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">This is the main content area of the card where you can place any content.</p>
                </CardContent>
              </Card>
            </StateDemo>
            
            <StateDemo label="Interactive Card">
              <Card className="w-80 hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Interactive Card
                    </CardTitle>
                    <Badge>New</Badge>
                  </div>
                  <CardDescription>This card has hover effects and interactive elements.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Click anywhere on this card</span>
                    <Button size="sm">Action</Button>
                  </div>
                </CardContent>
              </Card>
            </StateDemo>
          </ComponentShowcase>

          {/* Shiny Chips */}
          <ComponentShowcase
            title="Shiny Chips"
            path="app/globals.css (.shiny-chip classes)"
            description="Eye-catching animated badges with shimmer and glow effects. Use sparingly for high-emphasis elements."
          >
            <StateDemo label="Shiny Chip Variants (hover me!)">
              <Badge className="shiny-chip shiny-chip-success !text-white">$146.70</Badge>
              <Badge className="shiny-chip shiny-chip-primary !text-white">Featured</Badge>
              <Badge className="shiny-chip shiny-chip-warning !text-white">In Progress</Badge>
              <Badge className="shiny-add-funds-chip !text-white">Add Funds</Badge>
            </StateDemo>

            <StateDemo label="Usage Example">
              <div className="text-lg text-muted-foreground">
                Join <Badge variant="secondary" className="mx-1 text-lg text-muted-foreground bg-muted">112 writers</Badge>
                {' '}who've made{' '}
                <Badge variant="secondary" className="mx-1 text-lg shiny-chip shiny-chip-success !text-white">$146.70</Badge>
                {' '}helping to build humanity's shared knowledge.
              </div>
            </StateDemo>

            <StateDemo label="Implementation">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">How to Use</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Apply the base <code className="bg-muted px-1 rounded">shiny-chip</code> class along with a variant class:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1 rounded">shiny-chip shiny-chip-success</code> - Green glow for earnings, positive metrics</li>
                  <li>• <code className="bg-muted px-1 rounded">shiny-chip shiny-chip-primary</code> - Blue glow for primary highlights</li>
                  <li>• <code className="bg-muted px-1 rounded">shiny-chip shiny-chip-warning</code> - Amber glow for caution, pending states</li>
                  <li>• <code className="bg-muted px-1 rounded">shiny-add-funds-chip</code> - Special "Add Funds" style (standalone)</li>
                </ul>
                <h4 className="font-medium mt-4 mb-2">Animation Details</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1 rounded">shimmer</code> - Gradient sweep animation (2.5s, faster on hover)</li>
                  <li>• <code className="bg-muted px-1 rounded">glow-pulse</code> - Pulsing box-shadow (2s)</li>
                  <li>• <code className="bg-muted px-1 rounded">scale(1.05)</code> on hover, <code className="bg-muted px-1 rounded">scale(0.98)</code> on active</li>
                </ul>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Badges */}
          <ComponentShowcase
            title="Badge"
            path="app/components/ui/badge.tsx"
            description="Interactive status indicators and labels with hover/active states"
          >
            <StateDemo label="Interactive Variants (hover me!)">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="success-secondary">Success Light</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="destructive-secondary">Destructive Light</Badge>
              <Badge variant="warning">Warning</Badge>
            </StateDemo>

            <StateDemo label="Static Variants (no interaction)">
              <Badge variant="default-static">Default</Badge>
              <Badge variant="secondary-static">Secondary</Badge>
              <Badge variant="outline-static">Outline</Badge>
              <Badge variant="success-static">Success</Badge>
              <Badge variant="destructive-static">Destructive</Badge>
            </StateDemo>

            <StateDemo label="Sizes">
              <Badge size="sm">Small</Badge>
              <Badge size="default">Default</Badge>
              <Badge size="lg">Large</Badge>
            </StateDemo>

            <StateDemo label="With Icons">
              <Badge><Star className="mr-1 h-3 w-3" />Featured</Badge>
              <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Verified</Badge>
              <Badge variant="success"><Check className="mr-1 h-3 w-3" />Success</Badge>
              <Badge variant="destructive"><X className="mr-1 h-3 w-3" />Error</Badge>
            </StateDemo>
          </ComponentShowcase>

          {/* Form Controls */}
          <ComponentShowcase
            title="Form Controls"
            path="app/components/ui/"
            description="Interactive form elements including switches and checkboxes"
          >
            <StateDemo label="Switch">
              <div className="flex items-center space-x-2">
                <Switch
                  id="demo-switch"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <label htmlFor="demo-switch" className="text-sm">
                  {switchChecked ? 'Enabled' : 'Disabled'}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="disabled-switch" disabled />
                <label htmlFor="disabled-switch" className="text-sm text-muted-foreground">
                  Disabled Switch
                </label>
              </div>
            </StateDemo>

            <StateDemo label="Checkbox">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="demo-checkbox"
                  checked={checkboxChecked}
                  onCheckedChange={setCheckboxChecked}
                />
                <label htmlFor="demo-checkbox" className="text-sm">
                  {checkboxChecked ? 'Checked' : 'Unchecked'}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="disabled-checkbox" disabled />
                <label htmlFor="disabled-checkbox" className="text-sm text-muted-foreground">
                  Disabled Checkbox
                </label>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Icons */}
          <ComponentShowcase
            title="Icons"
            path="lucide-react"
            description="Lucide React icons used throughout the application"
          >
            <StateDemo label="Common Icons">
              <div className="grid grid-cols-8 gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Search className="h-6 w-6" />
                  <span className="text-xs">Search</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Heart className="h-6 w-6" />
                  <span className="text-xs">Heart</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Star className="h-6 w-6" />
                  <span className="text-xs">Star</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Settings className="h-6 w-6" />
                  <span className="text-xs">Settings</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <User className="h-6 w-6" />
                  <span className="text-xs">User</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Mail className="h-6 w-6" />
                  <span className="text-xs">Mail</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Lock className="h-6 w-6" />
                  <span className="text-xs">Lock</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Palette className="h-6 w-6" />
                  <span className="text-xs">Palette</span>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Status Icons">
              <div className="grid grid-cols-6 gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Check className="h-6 w-6 text-green-500" />
                  <span className="text-xs">Success</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <X className="h-6 w-6 text-red-500" />
                  <span className="text-xs">Error</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                  <span className="text-xs">Warning</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Info className="h-6 w-6 text-blue-500" />
                  <span className="text-xs">Info</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Loading</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Plus className="h-6 w-6" />
                  <span className="text-xs">Add</span>
                </div>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* PillLink Components - Comprehensive Table */}
          <ComponentShowcase
            title="PillLink Components Matrix"
            path="app/components/utils/PillLink.tsx + UsernameBadge.tsx"
            description="Complete showcase of all pill link styles and types. Hover and click to test interactions!"
          >
            <div className="wewrite-card p-4 bg-muted/30 overflow-x-auto">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Table Structure:</strong> Rows = Styles, Columns = Link Types. All interactions use <code className="bg-muted px-1 rounded">scale-[1.05]</code> on hover and <code className="bg-muted px-1 rounded">scale-[0.95]</code> on active.
                </p>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Style</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Page Link</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">User (no sub)</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">User (tier 3)</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">External Link</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Compound Link</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Filled Style Row */}
                  <tr className="border-b border-border/50">
                    <td className="p-3 align-middle">
                      <div>
                        <p className="text-sm font-medium">Filled</p>
                        <p className="text-xs text-muted-foreground mt-1">Default style</p>
                      </div>
                    </td>
                    <td className="p-3 align-middle">
                      <PillLink href="/example" pageId="ex1" clickable={false}>AI Research</PillLink>
                    </td>
                    <td className="p-3 align-middle">
                      <UsernameBadge
                        userId="user1"
                        username="alex"
                        tier={null}
                        subscriptionStatus={null}
                        subscriptionAmount={null}
                        variant="pill"
                        pillVariant="primary"
                      />
                    </td>
                    <td className="p-3 align-middle">
                      <UsernameBadge
                        userId="user2"
                        username="sarah"
                        tier="tier3"
                        subscriptionStatus="active"
                        subscriptionAmount={35}
                        variant="pill"
                        pillVariant="primary"
                      />
                    </td>
                    <td className="p-3 align-middle">
                      <PillLink href="https://example.com" clickable={false}>Documentation</PillLink>
                    </td>
                    <td className="p-3 align-middle">
                      <div className="inline-flex items-center gap-1.5">
                        <PillLink href="/page" pageId="p1" clickable={false}>Startup Guide</PillLink>
                        <span className="text-sm text-muted-foreground">by</span>
                        <UsernameBadge
                          userId="user3"
                          username="jamie"
                          tier="tier3"
                          subscriptionStatus="active"
                          subscriptionAmount={30}
                          variant="pill"
                          pillVariant="secondary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Outline Style Row */}
                  <tr className="border-b border-border/50">
                    <td className="p-3 align-middle">
                      <div>
                        <p className="text-sm font-medium">Outline</p>
                        <p className="text-xs text-muted-foreground mt-1">Bordered style</p>
                      </div>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                        AI Research
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                        <span>alex</span>
                        <span className="inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                        <span>sarah</span>
                        <span className="inline-flex items-center gap-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                        <span>Documentation</span>
                        <ExternalLink size={14} className="ml-1.5 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <div className="inline-flex items-center gap-1.5">
                        <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                          Startup Guide
                        </a>
                        <span className="text-sm text-muted-foreground">by</span>
                        <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border border-muted-foreground/30 hover:bg-muted hover:border-muted-foreground/50 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                          <span>jamie</span>
                          <span className="inline-flex items-center gap-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </span>
                        </a>
                      </div>
                    </td>
                  </tr>

                  {/* Text Only Style Row */}
                  <tr className="border-b border-border/50">
                    <td className="p-3 align-middle">
                      <div>
                        <p className="text-sm font-medium">Text Only</p>
                        <p className="text-xs text-muted-foreground mt-1">Minimal style</p>
                      </div>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        AI Research
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>alex</span>
                        <span className="inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>sarah</span>
                        <span className="inline-flex items-center gap-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>Documentation</span>
                        <ExternalLink size={14} className="ml-1.5 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <div className="inline-flex items-center gap-1.5">
                        <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                          Startup Guide
                        </a>
                        <span className="text-sm text-muted-foreground">by</span>
                        <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border-none hover:underline hover:bg-muted/50 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                          <span>jamie</span>
                          <span className="inline-flex items-center gap-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </span>
                        </a>
                      </div>
                    </td>
                  </tr>

                  {/* Underlined Style Row */}
                  <tr>
                    <td className="p-3 align-middle">
                      <div>
                        <p className="text-sm font-medium">Underlined</p>
                        <p className="text-xs text-muted-foreground mt-1">Always underlined</p>
                      </div>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        AI Research
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>alex</span>
                        <span className="inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>sarah</span>
                        <span className="inline-flex items-center gap-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </span>
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                        <span>Documentation</span>
                        <ExternalLink size={14} className="ml-1.5 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="p-3 align-middle">
                      <div className="inline-flex items-center gap-1.5">
                        <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                          Startup Guide
                        </a>
                        <span className="text-sm text-muted-foreground">by</span>
                        <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border-none underline hover:decoration-2 hover:bg-muted/50 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                          <span>jamie</span>
                          <span className="inline-flex items-center gap-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </span>
                        </a>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <StateDemo label="Style Configuration">
              <div className="wewrite-card p-4 bg-muted/30">
                <h4 className="font-medium mb-2">Available Styles</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Users can change their preferred pill style in Settings via <code className="bg-muted px-1 rounded">PillStyleContext</code>.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1 rounded">filled</code> - Bold filled background (default)</li>
                  <li>• <code className="bg-muted px-1 rounded">outline</code> - Bordered with transparent background</li>
                  <li>• <code className="bg-muted px-1 rounded">text_only</code> - Clean text that underlines on hover</li>
                  <li>• <code className="bg-muted px-1 rounded">underlined</code> - Always underlined text</li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Special States">
              <div className="flex flex-wrap gap-2">
                <PillLink href="/deleted-page" deleted={true}>Deleted Page</PillLink>
                <PillLink href="/suggestion" isSuggestion={true}>Link Suggestion</PillLink>
                <PillLink href="/example-page" pageId="example123" isLoading={true}>Loading...</PillLink>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Color System */}
          <ComponentShowcase
            title="Color System"
            path="app/styles/"
            description="WeWrite's glassmorphic color system with theme support"
          >
            <StateDemo label="Card System">
              <div className="grid grid-cols-2 gap-4">
                <div className="wewrite-card p-4">
                  <h4 className="font-medium mb-2">Default Card</h4>
                  <p className="text-sm text-muted-foreground">
                    Uses glassmorphic background with theme-aware colors
                  </p>
                </div>
                <div className="wewrite-card p-4 hover:bg-muted/50 transition-colors">
                  <h4 className="font-medium mb-2">Interactive Card</h4>
                  <p className="text-sm text-muted-foreground">
                    Hover to see the interaction state
                  </p>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Text Colors">
              <div className="space-y-2">
                <p className="text-foreground">Primary text (foreground)</p>
                <p className="text-muted-foreground">Secondary text (muted-foreground)</p>
                <p className="text-primary">Primary accent color</p>
                <p className="text-destructive">Destructive/error color</p>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Typography */}
          <ComponentShowcase
            title="Typography"
            path="app/globals.css"
            description="Text styles and hierarchy used throughout the application"
          >
            <StateDemo label="Headings">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold">Heading 1</h1>
                <h2 className="text-3xl font-bold">Heading 2</h2>
                <h3 className="text-2xl font-semibold">Heading 3</h3>
                <h4 className="text-xl font-semibold">Heading 4</h4>
                <h5 className="text-lg font-medium">Heading 5</h5>
                <h6 className="text-base font-medium">Heading 6</h6>
              </div>
            </StateDemo>

            <StateDemo label="Body Text">
              <div className="space-y-2">
                <p className="text-base">Regular body text with normal weight and size.</p>
                <p className="text-sm">Small text for captions and secondary information.</p>
                <p className="text-xs">Extra small text for fine print and metadata.</p>
                <p className="text-base font-medium">Medium weight text for emphasis.</p>
                <p className="text-base font-semibold">Semibold text for stronger emphasis.</p>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Inline Error Cards */}
          <ComponentShowcase
            title="Inline Error Cards"
            path="app/components/ui/InlineError.tsx"
            description="Unified error, warning, and info display component with multiple variants and sizes"
          >
            <StateDemo label="Variants">
              <div className="w-full space-y-3">
                <InlineError
                  message="Something went wrong. Please try again."
                  variant="error"
                  size="md"
                />
                <InlineError
                  message="Your session will expire in 5 minutes."
                  variant="warning"
                  size="md"
                />
                <InlineError
                  message="Your changes have been saved automatically."
                  variant="info"
                  size="md"
                />
              </div>
            </StateDemo>

            <StateDemo label="Sizes">
              <div className="w-full space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Small (sm)</p>
                  <InlineError
                    message="Invalid email format"
                    variant="error"
                    size="sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Medium (md) - Default</p>
                  <InlineError
                    message="Failed to save changes. Please check your connection."
                    variant="error"
                    size="md"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Large (lg)</p>
                  <InlineError
                    message="We couldn't load your data. This might be a temporary issue."
                    title="Connection Error"
                    variant="error"
                    size="lg"
                  />
                </div>
              </div>
            </StateDemo>

            <StateDemo label="With Actions">
              <div className="w-full space-y-3">
                <InlineError
                  message="Failed to load page content."
                  variant="error"
                  size="md"
                  onRetry={() => alert('Retry clicked!')}
                  retryLabel="Retry"
                />
                <InlineError
                  message="An unexpected error occurred."
                  variant="error"
                  size="md"
                  errorDetails="Error: NETWORK_ERROR\nTimestamp: 2024-01-15T10:30:00Z\nStack: at fetchData (app.js:42)"
                  showCopy={true}
                />
                <InlineError
                  message="Unable to process your request."
                  title="Request Failed"
                  variant="error"
                  size="lg"
                  errorDetails="Error: 500 Internal Server Error\nRequest ID: abc-123-def"
                  showCopy={true}
                  showCollapsible={true}
                  onRetry={() => alert('Retry clicked!')}
                />
              </div>
            </StateDemo>

            <StateDemo label="Usage Examples">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">When to Use Each Variant</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong className="text-orange-600 dark:text-orange-400">error</strong>: Form validation errors, API failures, auth errors</li>
                  <li>• <strong className="text-amber-600 dark:text-amber-400">warning</strong>: Session timeouts, deprecation notices, incomplete actions</li>
                  <li>• <strong className="text-primary">info</strong>: Helpful tips, auto-save confirmations, feature announcements</li>
                </ul>
                <h4 className="font-medium mt-4 mb-2">Size Guidelines</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1 rounded">sm</code>: Inline form field errors, compact notices</li>
                  <li>• <code className="bg-muted px-1 rounded">md</code>: Standard error cards, form-level errors</li>
                  <li>• <code className="bg-muted px-1 rounded">lg</code>: Full page errors, error boundaries, critical alerts</li>
                </ul>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Banner System */}
          <ComponentShowcase
            title="Banner System"
            path="app/components/utils/"
            description="Priority-based banner system for email verification and PWA installation"
          >
            <StateDemo label="Email Verification Banner">
              <div className="w-full max-w-md">
                <div className="relative mx-4 mb-4 md:block">
                  <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-sm opacity-100 transform translate-y-0 scale-100 max-h-32">
                    <div className="flex items-center space-x-2 mb-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Please verify your email address</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" className="h-9 text-xs text-foreground">
                        Later
                      </Button>
                      <Button variant="default" size="sm" className="h-9 text-xs">
                        How?
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="PWA Installation Banner">
              <div className="w-full max-w-md">
                <div className="relative mx-4 mb-4 md:block">
                  <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-sm opacity-100 transform translate-y-0 scale-100 max-h-32">
                    <div className="flex items-center space-x-2 mb-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Want to use WeWrite as an app?</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="secondary" size="sm" className="h-9 text-xs text-foreground">
                        Never
                      </Button>
                      <Button variant="secondary" size="sm" className="h-9 text-xs text-foreground">
                        Later
                      </Button>
                      <Button variant="default" size="sm" className="h-9 text-xs">
                        Yes!
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Banner Design Notes">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">Design System Integration</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Uses <code className="bg-muted px-1 rounded">bg-muted/50</code> for glassmorphic background</li>
                  <li>• Consistent with card system styling and borders</li>
                  <li>• Mobile-first design with <code className="bg-muted px-1 rounded">md:hidden</code></li>
                  <li>• Priority system: Email verification → PWA installation</li>
                  <li>• Smooth 300ms collapse/expand animations</li>
                  <li>• Two-button layout: Later, How? (opens help modal)</li>
                </ul>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Activity Card */}
          <ComponentShowcase
            title="Activity Card"
            path="app/components/activity/ActivityCard.tsx"
            description="Displays page edit activity with diff preview, author info, and allocation controls. Hover over sections to see their names."
          >
            <StateDemo label="Card Anatomy">
              <div className="w-full max-w-md">
                <div className="wewrite-card p-3">
                  {/* Header Section */}
                  <div className="flex justify-between items-start w-full mb-3 p-2 border border-dashed border-primary/50 rounded-lg relative">
                    <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-primary font-medium">Header Section</span>
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="bg-primary-10 text-primary px-2 py-0.5 rounded-lg text-xs font-medium">Example Page Title</span>
                        <span className="text-foreground whitespace-nowrap">edited by</span>
                        <span className="text-primary">username</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">2 hours ago</span>
                    </div>
                  </div>

                  {/* Diff Section */}
                  <div className="mb-3 p-2 border border-dashed border-green-500/50 rounded-lg relative">
                    <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-green-600 dark:text-green-400 font-medium">Diff Section</span>
                    {/* Light mode: outlined, Dark mode: filled (additive) */}
                    <div className="border border-border dark:border-transparent bg-neutral-alpha-dark-10 rounded-lg p-3 relative">
                      {/* Diff count at top right */}
                      <div className="absolute top-2 right-3">
                        <span className="text-xs font-medium flex items-center gap-1">
                          <span className="text-green-600 dark:text-green-400">+42</span>
                          <span className="text-red-600 dark:text-red-400">-8</span>
                        </span>
                      </div>
                      <div className="text-xs overflow-hidden pr-16">
                        <span className="text-muted-foreground">...existing content </span>
                        <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-0.5 rounded line-through">old text</span>
                        <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-0.5 rounded">new text added here</span>
                        <span className="text-muted-foreground"> more content...</span>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Section */}
                  <div className="p-2 border border-dashed border-blue-500/50 rounded-lg relative">
                    <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-blue-600 dark:text-blue-400 font-medium">Allocation Section</span>
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-2 bg-neutral-10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-1/3 rounded-full"></div>
                      </div>
                      <span className="text-xs text-muted-foreground">$0.50</span>
                    </div>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Section Descriptions">
              <div className="wewrite-card p-4 max-w-2xl">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong className="text-foreground">Header Section:</strong> Page title (PillLink), action verb (created/edited/renamed), author (UsernameBadge with subscription tier), and relative timestamp with full date tooltip.
                  </li>
                  <li>
                    <strong className="text-foreground">Diff Section:</strong> Inner card with different styling per mode:
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>• <strong>Light mode:</strong> Outlined with <code className="bg-muted px-1 rounded">border-border</code></li>
                      <li>• <strong>Dark mode:</strong> Filled with <code className="bg-muted px-1 rounded">bg-neutral-alpha-dark-10</code> (additive white overlay)</li>
                      <li>• <strong>DiffStats:</strong> Character count changes (+X / -Y format) positioned at top right</li>
                      <li>• <strong>DiffPreview:</strong> Context text with green additions and red strikethrough deletions</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-foreground">Allocation Section:</strong> Token allocation slider and controls for supporting the page author. Only shown when viewing other users' pages.
                  </li>
                  <li>
                    <strong className="text-foreground">Restore Section (conditional):</strong> Button to restore page to this version. Only shown on version history pages when user owns the page.
                  </li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Diff Styling Reference">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Added text:</p>
                  <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1 rounded text-sm">+new content</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Removed text:</p>
                  <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded line-through text-sm">-old content</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Context:</p>
                  <span className="text-muted-foreground text-sm">...surrounding text...</span>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Code Usage">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
                <pre className="text-xs overflow-x-auto">
{`<ActivityCard
  activity={{
    pageId: "abc123",
    pageName: "Example Page",
    userId: "user123",
    username: "jamie",
    timestamp: "2024-01-15T10:30:00Z",
    currentContent: "...",
    previousContent: "...",
    diff: { added: 42, removed: 8, hasChanges: true }
  }}
  isCarousel={false}
  compactLayout={false}
/>`}
                </pre>
              </div>
            </StateDemo>
          </ComponentShowcase>
        </div>
      </div>
    </div>
  );
}
