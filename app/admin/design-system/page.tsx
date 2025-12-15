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
  ChevronDown,
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
  ExternalLink,
  Type,
  Globe,
  AtSign,
  RefreshCw,
  Home,
  ArrowLeft,
  CheckCircle,
  Inbox,
  FileText,
  Tags,
  Users,
  FolderOpen
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '../../components/ui/drawer';
import { LoadingState, LoadingSpinner, LoadingDots, SkeletonLine, SkeletonCard } from '../../components/ui/LoadingState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../../components/ui/segmented-control';
import FullPageError from '../../components/ui/FullPageError';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '../../components/ui/table';
import EmptyState from '../../components/ui/EmptyState';
import { CompositionBar, CompositionBarData } from '../../components/payments/CompositionBar';
import { RollingCounter } from '../../components/ui/rolling-counter';
import { CounterBadge } from '../../components/ui/counter-badge';

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

// Interactive Allocation Bar Demo Component
function AllocationBarShowcase() {
  const [demoAllocation, setDemoAllocation] = React.useState(30);
  const [showPulse, setShowPulse] = React.useState(false);
  const [showParticles, setShowParticles] = React.useState(false);
  const otherPages = 20; // Fixed percentage for "other pages"
  const total = 100;
  const maxAllocation = 120; // Allow overspend up to 120% to demonstrate overfunded state
  const totalBudget = 10; // $10.00 total budget for demo

  const handleIncrement = () => {
    if (demoAllocation < maxAllocation) {
      setDemoAllocation(prev => Math.min(prev + 10, maxAllocation));
      setShowPulse(true);
      setShowParticles(true);
    }
  };

  const handleDecrement = () => {
    if (demoAllocation > 0) {
      setDemoAllocation(prev => Math.max(prev - 10, 0));
    }
  };

  // Calculate the display percentages based on total + overfunded for proper scaling
  const availableFunds = total - otherPages; // 80% available after other pages
  const currentFunded = Math.min(demoAllocation, availableFunds);
  const overfunded = Math.max(0, demoAllocation - availableFunds);
  const available = Math.max(0, availableFunds - currentFunded);

  // Calculate dollar amounts
  const allocatedDollars = (demoAllocation / 100) * totalBudget;
  const availableDollars = (availableFunds / 100) * totalBudget;

  // Scale all percentages to fit within display (total should be 100 or more if overfunded)
  const displayTotal = Math.max(total, otherPages + currentFunded + overfunded);
  const scaledOther = (otherPages / displayTotal) * 100;
  const scaledFunded = (currentFunded / displayTotal) * 100;
  const scaledOverfunded = (overfunded / displayTotal) * 100;
  const scaledAvailable = (available / displayTotal) * 100;

  return (
    <div className="wewrite-card space-y-4">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold">Allocation Bar</h3>
        <p className="text-sm text-muted-foreground">app/components/payments/AllocationControls.tsx</p>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive allocation interface with plus/minus buttons and visual composition bar. Features particle animations on allocation increases.
        </p>
      </div>
      <div className="space-y-6">
        {/* Interactive Demo */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Interactive Demo</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Click + to allocate. Keep clicking past 80% to see overfunded (amber) state.
          </p>

          {/* Dollar amount display with RollingCounter */}
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold">
              <RollingCounter value={allocatedDollars} prefix="$" decimals={2} duration={300} />
            </span>
            <span className="text-sm text-muted-foreground">
              / ${availableDollars.toFixed(2)} available
            </span>
            {overfunded > 0 && (
              <span className="text-sm text-amber-500 ml-1">
                (<RollingCounter value={(overfunded / 100) * totalBudget} prefix="$" decimals={2} duration={300} /> overfunded)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full max-w-md">
            {/* Minus button */}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20"
              onClick={handleDecrement}
              disabled={demoAllocation <= 0}
            >
              <Minus className="h-4 w-4" />
            </Button>

            {/* Composition bar */}
            <CompositionBar
              data={{
                otherPagesPercentage: scaledOther,
                currentPageFundedPercentage: scaledFunded,
                currentPageOverfundedPercentage: scaledOverfunded,
                availablePercentage: scaledAvailable,
                isOutOfFunds: available <= 0
              }}
              showPulse={showPulse}
              showParticles={showParticles}
              onPulseComplete={() => setShowPulse(false)}
              onParticlesComplete={() => setShowParticles(false)}
              size="md"
            />

            {/* Plus button */}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20"
              onClick={handleIncrement}
              disabled={demoAllocation >= maxAllocation}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Static Examples */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Distribution States</h4>
          <div className="space-y-4 w-full">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Empty (No Allocation)</p>
              <div className="flex items-center gap-3 max-w-md">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20" disabled>
                  <Minus className="h-4 w-4" />
                </Button>
                <CompositionBar
                  data={{ otherPagesPercentage: 0, currentPageFundedPercentage: 0, currentPageOverfundedPercentage: 0, availablePercentage: 100, isOutOfFunds: false }}
                  size="md"
                />
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Partial Allocation</p>
              <div className="flex items-center gap-3 max-w-md">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Minus className="h-4 w-4" />
                </Button>
                <CompositionBar
                  data={{ otherPagesPercentage: 20, currentPageFundedPercentage: 35, currentPageOverfundedPercentage: 0, availablePercentage: 45, isOutOfFunds: false }}
                  size="md"
                />
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Fully Allocated (Out of Funds)</p>
              <div className="flex items-center gap-3 max-w-md">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Minus className="h-4 w-4" />
                </Button>
                <CompositionBar
                  data={{ otherPagesPercentage: 50, currentPageFundedPercentage: 50, currentPageOverfundedPercentage: 0, availablePercentage: 0, isOutOfFunds: true }}
                  size="md"
                />
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20" disabled>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Overfunded (Amber Warning)</p>
              <div className="flex items-center gap-3 max-w-md">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Minus className="h-4 w-4" />
                </Button>
                <CompositionBar
                  data={{ otherPagesPercentage: 40, currentPageFundedPercentage: 40, currentPageOverfundedPercentage: 20, availablePercentage: 0, isOutOfFunds: true }}
                  size="md"
                />
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20" disabled>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Segment Colors */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Segment Colors</h4>
          <div className="space-y-3 w-full text-sm">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-neutral-20" />
              <span><code>Other Pages</code> - Neutral gray, previously allocated elsewhere</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-primary" />
              <span><code>Current Page (Funded)</code> - Primary brand color with particle animation</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-amber-500" />
              <span><code>Current Page (Overfunded)</code> - Amber warning when over budget</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-transparent border border-neutral-alpha-10" />
              <span><code>Available</code> - Solid outline, unfunded</span>
            </div>
          </div>
        </div>

        {/* Component Usage */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Components</h4>
          <div className="space-y-2 text-sm w-full">
            <div className="flex gap-2 items-center flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">AllocationControls</code>
              <span className="text-muted-foreground">- Used in ActivityCard, activity feeds</span>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">EmbeddedAllocationBar</code>
              <span className="text-muted-foreground">- Used in page cards, compact contexts</span>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">AllocationBar</code>
              <span className="text-muted-foreground">- Floating action bar on page view</span>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">CompositionBar</code>
              <span className="text-muted-foreground">- Shared visual component (bar only, no buttons)</span>
            </div>
          </div>
        </div>
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
  const [showDialog, setShowDialog] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showDrawerWithForm, setShowDrawerWithForm] = useState(false);
  // Overlay option switches
  const [overlayDark, setOverlayDark] = useState(true);
  const [overlayBlur, setOverlayBlur] = useState(false);
  // Full page error demo
  const [showFullPageError, setShowFullPageError] = useState(false);
  // Tabs and Segmented Control state
  const [activeTab, setActiveTab] = useState('tab1');
  const [activeSegment, setActiveSegment] = useState('segment1');
  // Rolling Counter demo state
  const [counterValue, setCounterValue] = useState(1234);
  const [dollarValue, setDollarValue] = useState(99.99);
  const [animationSpeed, setAnimationSpeed] = useState(400);

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

          {/* Rolling Counter / Odometer */}
          <div className="wewrite-card space-y-4">
            <div className="border-b border-border pb-4">
              <h3 className="text-lg font-semibold">Rolling Counter <span className="text-sm font-normal text-muted-foreground">(Odometer)</span></h3>
              <p className="text-sm text-muted-foreground">app/components/ui/rolling-counter.tsx</p>
              <p className="text-sm text-muted-foreground mt-1">
                Animated counter with slot machine style rolling digits. Also known as "odometer" in other design systems.
                Features direction-aware animation (rolls up when increasing, down when decreasing) and adaptive speed for rapid changes.
                Perfect for view counts, stats, and financial displays.
              </p>
            </div>
            <div className="space-y-6">
              {/* Interactive Demo */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Interactive Demo</h4>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Views Counter</p>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" onClick={() => setCounterValue(prev => Math.max(0, prev - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-3xl font-bold min-w-[180px]">
                        <RollingCounter value={counterValue} suffix=" views" duration={animationSpeed} />
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setCounterValue(prev => prev + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Dollar Amount</p>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" onClick={() => setDollarValue(prev => Math.max(0, prev - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-3xl font-bold min-w-[120px]">
                        <RollingCounter value={dollarValue} prefix="$" decimals={2} duration={animationSpeed} />
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setDollarValue(prev => prev + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Speed:</span>
                    <Button size="sm" variant="outline" onClick={() => setAnimationSpeed(prev => Math.max(100, prev - 100))}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-mono w-16 text-center">{animationSpeed}ms</span>
                    <Button size="sm" variant="outline" onClick={() => setAnimationSpeed(prev => Math.min(1000, prev + 100))}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setCounterValue(1234); setDollarValue(99.99); setAnimationSpeed(400); }}>Reset</Button>
                </div>
              </div>

              {/* Size Examples */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Size Variants</h4>
                <div className="flex flex-col gap-3">
                  <div className="text-sm"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-sm</span></div>
                  <div className="text-base"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-base</span></div>
                  <div className="text-xl"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-xl</span></div>
                  <div className="text-3xl font-bold"><RollingCounter value={counterValue} /> <span className="text-muted-foreground text-base ml-2">text-3xl font-bold</span></div>
                </div>
              </div>

              {/* Format Examples */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Format Examples</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">With commas (default)</p>
                    <RollingCounter value={1234567} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Without commas</p>
                    <RollingCounter value={1234567} formatWithCommas={false} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">With prefix</p>
                    <RollingCounter value={1234.56} prefix="$" decimals={2} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">With suffix</p>
                    <RollingCounter value={42} suffix=" items" />
                  </div>
                </div>
              </div>

              {/* CounterBadge - Composed Badge + RollingCounter */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground">CounterBadge (Badge + RollingCounter)</h4>
                <p className="text-xs text-muted-foreground">
                  Composes Badge with RollingCounter for animated pill counters. Inherits all Badge variants and shiny mode support.
                </p>

                {/* Variant Examples */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Variants (click to increment)</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCounterValue(prev => prev + 1)}>
                      <CounterBadge value={counterValue} variant="default" />
                    </button>
                    <button onClick={() => setCounterValue(prev => prev + 1)}>
                      <CounterBadge value={counterValue} variant="secondary" />
                    </button>
                    <button onClick={() => setCounterValue(prev => prev + 1)}>
                      <CounterBadge value={counterValue} variant="outline" />
                    </button>
                    <button onClick={() => setCounterValue(prev => prev + 1)}>
                      <CounterBadge value={counterValue} variant="destructive" />
                    </button>
                    <button onClick={() => setCounterValue(prev => prev + 1)}>
                      <CounterBadge value={counterValue} variant="success" />
                    </button>
                  </div>
                </div>

                {/* Size Examples */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Sizes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <CounterBadge value={counterValue} size="sm" />
                    <CounterBadge value={counterValue} size="default" />
                    <CounterBadge value={counterValue} size="lg" />
                  </div>
                </div>

                {/* With Prefix/Suffix */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">With Prefix/Suffix</p>
                  <div className="flex flex-wrap gap-2">
                    <CounterBadge value={dollarValue} prefix="$" decimals={2} variant="success" />
                    <CounterBadge value={counterValue} suffix=" views" variant="secondary" />
                    <CounterBadge value={counterValue} suffix=" new" variant="destructive" />
                  </div>
                </div>

                {/* Static (non-animated) */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Static (no animation)</p>
                  <div className="flex flex-wrap gap-2">
                    <CounterBadge value={42} animated={false} />
                    <CounterBadge value={99} animated={false} variant="secondary" />
                    <CounterBadge value={5} animated={false} variant="outline" suffix=" items" />
                  </div>
                </div>
              </div>
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

              {/* Neutral Solid Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Neutral Solid Colors</h4>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Solid colors</strong> are opaque fills derived from the primary hue with low chroma (oklch).
                  Use <code className="bg-muted px-1 rounded">neutral-solid-{'{N}'}</code> when you need a consistent, opaque background
                  that doesn't allow content behind it to show through.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-solid-30 rounded flex items-center justify-center">30%</div>
                    <code className="text-muted-foreground">bg-neutral-solid-30</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-solid-20 rounded flex items-center justify-center">20%</div>
                    <code className="text-muted-foreground">bg-neutral-solid-20</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-solid-15 rounded flex items-center justify-center">15%</div>
                    <code className="text-muted-foreground">bg-neutral-solid-15</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-solid-10 rounded flex items-center justify-center">10%</div>
                    <code className="text-muted-foreground">bg-neutral-solid-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-solid-5 rounded flex items-center justify-center">5%</div>
                    <code className="text-muted-foreground">bg-neutral-solid-5</code>
                  </div>
                </div>
              </div>

              {/* Neutral Alpha Colors */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Neutral Alpha Colors</h4>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Alpha colors</strong> are transparent overlays (rgba) that adapt to light/dark mode.
                  In light mode they use black, in dark mode they use white. Use <code className="bg-muted px-1 rounded">neutral-alpha-{'{N}'}</code>
                  when you want content behind to show through or for hover/overlay effects.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-30 rounded flex items-center justify-center">30%</div>
                    <code className="text-muted-foreground">bg-neutral-alpha-30</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-20 rounded flex items-center justify-center">20%</div>
                    <code className="text-muted-foreground">bg-neutral-alpha-20</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-15 rounded flex items-center justify-center">15%</div>
                    <code className="text-muted-foreground">bg-neutral-alpha-15</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-10 rounded flex items-center justify-center">10%</div>
                    <code className="text-muted-foreground">bg-neutral-alpha-10</code>
                  </div>
                  <div className="space-y-1">
                    <div className="h-8 bg-neutral-alpha-5 rounded flex items-center justify-center">5%</div>
                    <code className="text-muted-foreground">bg-neutral-alpha-5</code>
                  </div>
                </div>
                <div className="wewrite-card p-4 bg-muted/30 mt-3">
                  <p className="text-sm font-medium mb-2">Solid vs Alpha - When to use which:</p>
                  <div className="text-sm space-y-1">
                    <p><strong className="text-success">Solid:</strong> Card backgrounds, buttons, chips - opaque fills that cover content</p>
                    <p><strong className="text-primary">Alpha:</strong> Hover states, overlays, glassmorphism - transparent effects</p>
                  </div>
                </div>
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
                <h4 className="font-medium text-sm">Hover/Active Alpha Overlays</h4>
                <p className="text-sm text-muted-foreground">
                  Shorthand <code className="bg-muted px-1 rounded">alpha-{'{N}'}</code> classes are aliases for <code className="bg-muted px-1 rounded">neutral-alpha-{'{N}'}</code>.
                  Use for hover/active state overlays on buttons and interactive elements.
                  <strong className="text-foreground"> These darken in light mode and brighten in dark mode.</strong>
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
                    <p><strong>Secondary buttons:</strong> <code className="bg-muted px-1 rounded">bg-neutral-solid-10 hover:alpha-10 active:alpha-15</code></p>
                    <p><strong>Outline buttons:</strong> <code className="bg-muted px-1 rounded">border border-neutral-alpha-20 hover:bg-neutral-alpha-5</code></p>
                    <p><strong>Ghost buttons:</strong> <code className="bg-muted px-1 rounded">hover:bg-neutral-alpha-5 active:bg-neutral-alpha-10</code></p>
                    <p><strong>Cards:</strong> <code className="bg-muted px-1 rounded">bg-card border border-border</code></p>
                    <p><strong>Active chips:</strong> <code className="bg-muted px-1 rounded">bg-primary-10 text-primary</code></p>
                    <p><strong>Inactive chips:</strong> <code className="bg-muted px-1 rounded">bg-neutral-solid-10 text-foreground</code></p>
                    <p><strong>Success-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-success-10 hover:success-alpha-10</code></p>
                    <p><strong>Destructive-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-error-10 hover:error-alpha-10</code></p>
                  </div>
                </div>
                <div className="wewrite-card p-4 space-y-2 bg-warning/10 border-warning/30">
                  <p className="text-sm font-medium text-warning">Naming Conventions</p>
                  <div className="text-sm space-y-1">
                    <p><code className="bg-muted px-1 rounded">neutral-solid-{'{N}'}</code> = Opaque fill (oklch color with lightness)</p>
                    <p><code className="bg-muted px-1 rounded">neutral-alpha-{'{N}'}</code> = Transparent overlay (rgba black/white)</p>
                    <p className="text-muted-foreground text-xs mt-2">Note: <code>neutral-{'{N}'}</code> without suffix is an alias for <code>neutral-solid-{'{N}'}</code> - prefer explicit naming.</p>
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
            <StateDemo label="Shimmer Base Class (hover me!)">
              <div className="flex flex-wrap gap-4 items-start">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Add <code className="bg-muted px-1 rounded">shiny-shimmer-base</code> to any element:</p>
                  <Button className="shiny-shimmer-base">With Shimmer</Button>
                  <Button>Without Shimmer</Button>
                </div>
                <div className="wewrite-card p-3 text-xs text-muted-foreground max-w-sm">
                  <p className="font-medium text-foreground mb-1">How it works:</p>
                  <ul className="space-y-1">
                    <li>• <code className="bg-muted px-0.5 rounded">::before</code> pseudo-element with gradient</li>
                    <li>• <code className="bg-muted px-0.5 rounded">opacity: 0</code> at rest (invisible)</li>
                    <li>• On hover: <code className="bg-muted px-0.5 rounded">opacity: 1</code> + animate</li>
                    <li>• Gradient slides left-to-right once</li>
                  </ul>
                </div>
              </div>
            </StateDemo>

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

          {/* Shiny Button System */}
          <ComponentShowcase
            title="Shiny Button System"
            path="app/globals.css + app/components/ui/button.tsx"
            description="Shimmer animation system using CSS class inheritance. Shimmer is invisible at rest and slides once on hover."
          >
            <StateDemo label="Shiny Buttons (hover me!)">
              <div className="flex flex-wrap gap-2">
                <Button className="shiny-shimmer-base shiny-glow-base button-shiny-style">Primary</Button>
                <Button variant="secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-secondary-shiny-style">Secondary</Button>
                <Button variant="outline" className="shiny-shimmer-base button-outline-shiny-style">Outline</Button>
                <Button variant="destructive" className="shiny-shimmer-base shiny-glow-base button-destructive-shiny-style">Destructive</Button>
                <Button variant="success" className="shiny-shimmer-base shiny-glow-base button-success-shiny-style">Success</Button>
              </div>
            </StateDemo>

            <StateDemo label="Light Variants (hover me!)">
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive-secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-destructive-secondary-shiny-style">Destructive Light</Button>
                <Button variant="success-secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-success-secondary-shiny-style">Success Light</Button>
              </div>
            </StateDemo>

            <StateDemo label="CSS Class Inheritance">
              <div className="wewrite-card p-4 max-w-2xl space-y-4">
                <h4 className="font-medium">Base Classes (in globals.css)</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <code className="bg-muted px-1 rounded font-mono">.shiny-shimmer-base</code>
                    <p className="mt-1 ml-4">Provides the shimmer animation via ::before pseudo-element. Invisible at rest, slides left-to-right once on hover.</p>
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded font-mono">.shiny-glow-base</code>
                    <p className="mt-1 ml-4">Adds border glow and text shadow. Used for solid colored buttons (primary, destructive, success).</p>
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded font-mono">.shiny-skeuomorphic-base</code>
                    <p className="mt-1 ml-4">Adds inset shadows and gradient overlay. Used for light buttons (secondary, *-secondary variants).</p>
                  </li>
                </ul>

                <h4 className="font-medium mt-4">Variant-Specific Classes</h4>
                <p className="text-sm text-muted-foreground mb-2">These only add color-specific box-shadows:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1 rounded">.button-shiny-style</code> - Primary blue glow</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-destructive-shiny-style</code> - Red glow</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-success-shiny-style</code> - Green glow</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-secondary-shiny-style</code> - Subtle neutral glow</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-outline-shiny-style</code> - Border enhancement</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-destructive-secondary-shiny-style</code> - Light red glow</li>
                  <li>• <code className="bg-muted px-1 rounded">.button-success-secondary-shiny-style</code> - Light green glow</li>
                </ul>

                <h4 className="font-medium mt-4">Composition Pattern</h4>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono space-y-1">
                  <p>Solid buttons: shimmer + glow + color</p>
                  <p className="text-xs opacity-75">shiny-shimmer-base shiny-glow-base button-shiny-style</p>
                  <p className="mt-2">Light buttons: shimmer + skeuomorphic + color</p>
                  <p className="text-xs opacity-75">shiny-shimmer-base shiny-skeuomorphic-base button-secondary-shiny-style</p>
                </div>
              </div>
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
            
            <StateDemo label="With Left Icon">
              <Input
                placeholder="Search..."
                leftIcon={<Search className="h-4 w-4" />}
                className="w-64"
              />
              <Input
                placeholder="Email address"
                leftIcon={<Mail className="h-4 w-4" />}
                className="w-64"
              />
              <Input
                placeholder="Custom title"
                leftIcon={<Type className="h-4 w-4" />}
                className="w-64"
              />
            </StateDemo>

            <StateDemo label="With Right Icon">
              <Input
                placeholder="Website URL"
                rightIcon={<Globe className="h-4 w-4" />}
                className="w-64"
              />
              <Input
                placeholder="Username"
                rightIcon={<AtSign className="h-4 w-4" />}
                className="w-64"
              />
            </StateDemo>

            <StateDemo label="With Both Icons">
              <Input
                placeholder="Search users..."
                leftIcon={<Search className="h-4 w-4" />}
                rightIcon={<Check className="h-4 w-4 text-green-500" />}
                className="w-64"
              />
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

          {/* NOTE: Chips do not exist in our design system. Use Badge instead. */}

          {/* Badges */}
          <ComponentShowcase
            title="Badge"
            path="app/components/ui/badge.tsx"
            description="Interactive status indicators and labels. NOTE: 'Chips' do not exist in our design system - use Badge for all pill-shaped indicators. In 'Shiny' UI mode (Settings > Appearance), badges automatically get skeuomorphic styling with shimmer effects on hover."
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
              <Badge variant="warning-secondary">Warning Light</Badge>
            </StateDemo>

            <StateDemo label="Static Variants (no interaction)">
              <Badge variant="default-static">Default</Badge>
              <Badge variant="secondary-static">Secondary</Badge>
              <Badge variant="outline-static">Outline</Badge>
              <Badge variant="success-static">Success</Badge>
              <Badge variant="destructive-static">Destructive</Badge>
              <Badge variant="warning-static">Warning</Badge>
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

            <StateDemo label="Usage Example (in shiny mode, these get shimmer effects)">
              <div className="text-lg text-muted-foreground">
                Join <Badge variant="secondary" className="mx-1 text-lg">112 writers</Badge>
                {' '}who've made{' '}
                <Badge variant="success" className="mx-1 text-lg">$146.70</Badge>
                {' '}helping to build humanity's shared knowledge.
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Form Controls */}
          <ComponentShowcase
            title="Form Controls"
            path="app/components/ui/"
            description="Interactive form elements including switches and checkboxes"
          >
            <StateDemo label="Switch Sizes">
              <div className="flex items-center space-x-3">
                <Switch
                  id="switch-sm"
                  size="sm"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <label htmlFor="switch-sm" className="text-sm">
                  Small
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  id="switch-md"
                  size="md"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <label htmlFor="switch-md" className="text-sm">
                  Medium (default)
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  id="switch-lg"
                  size="lg"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <label htmlFor="switch-lg" className="text-sm">
                  Large
                </label>
              </div>
            </StateDemo>

            <StateDemo label="Switch States">
              <div className="flex items-center space-x-3">
                <Switch id="switch-off" checked={false} />
                <label htmlFor="switch-off" className="text-sm">
                  Off State
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch id="switch-on" checked={true} />
                <label htmlFor="switch-on" className="text-sm">
                  On State
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch id="disabled-switch-off" disabled checked={false} />
                <label htmlFor="disabled-switch-off" className="text-sm text-muted-foreground">
                  Disabled Off
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch id="disabled-switch-on" disabled checked={true} />
                <label htmlFor="disabled-switch-on" className="text-sm text-muted-foreground">
                  Disabled On
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
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  ⚠️ IMPORTANT: Always use <code className="bg-red-100 dark:bg-red-800 px-1 rounded">wewrite-card</code> class for ALL card styling.
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Never use custom combinations like <code className="bg-red-100 dark:bg-red-800 px-1 rounded">bg-card rounded-xl border</code>.
                  This ensures consistent glassmorphism, themes, and prevents regressions.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="wewrite-card">
                  <h4 className="font-medium mb-2">Default Card</h4>
                  <p className="text-sm text-muted-foreground">
                    Uses glassmorphic background with theme-aware colors
                  </p>
                </div>
                <div className="wewrite-card cursor-pointer">
                  <h4 className="font-medium mb-2">Interactive Card</h4>
                  <p className="text-sm text-muted-foreground">
                    Hover to see the built-in interaction state
                  </p>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Card Modifiers">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use modifier classes to customize cards while keeping base styling:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="wewrite-card card-50">
                    <span className="text-xs font-mono">card-50</span>
                    <p className="text-xs text-muted-foreground">50% opacity</p>
                  </div>
                  <div className="wewrite-card wewrite-card-rounded-sm">
                    <span className="text-xs font-mono">wewrite-card-rounded-sm</span>
                    <p className="text-xs text-muted-foreground">Small radius</p>
                  </div>
                  <div className="wewrite-card wewrite-card-no-padding p-2">
                    <span className="text-xs font-mono">wewrite-card-no-padding</span>
                    <p className="text-xs text-muted-foreground">Custom padding</p>
                  </div>
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

            <StateDemo label="Banner Priority System">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">One Banner at a Time</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Only one banner shows at a time, following this priority order:
                </p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside mb-4">
                  <li><strong className="text-foreground">Email Verification</strong> - Highest priority, shows until verified or dismissed</li>
                  <li><strong className="text-foreground">Username Setup</strong> - Shows if email verified but username invalid</li>
                  <li><strong className="text-foreground">PWA Installation</strong> - Lowest priority, only shows when others are dismissed</li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  Managed by <code className="bg-muted px-1 rounded">BannerProvider</code> which cascades to the next banner when one is dismissed.
                </p>
              </div>
            </StateDemo>

            <StateDemo label="Banner Layout Architecture">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">CSS Variable System</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Banners use CSS variables to communicate their height to the rest of the app:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                  <li>• <code className="bg-muted px-1 rounded">--email-banner-height</code> - Set by EmailVerificationTopBanner (40px when visible)</li>
                  <li>• <code className="bg-muted px-1 rounded">--pwa-banner-height</code> - Set by PWABanner (40px when visible)</li>
                </ul>
                <h4 className="font-medium mb-2 mt-4">Content Offset Implementation</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  All page layouts must account for banner height. Use one of these approaches:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong className="text-foreground">Option 1: CSS Variable (Recommended)</strong>
                    <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
{`<div style={{ paddingTop: 'var(--email-banner-height, 0px)' }}>
  {/* Page content */}
</div>`}
                    </pre>
                  </li>
                  <li>
                    <strong className="text-foreground">Option 2: BannerProvider Hook</strong>
                    <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
{`const { bannerOffset } = useBanner();
// bannerOffset is the calculated height in pixels`}
                    </pre>
                  </li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Fixed Header Integration">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">Z-Index Layering</h4>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>• Banners: <code className="bg-muted px-1 rounded">z-100</code> - Above headers</li>
                  <li>• Headers/Nav: <code className="bg-muted px-1 rounded">z-50</code> - Below banners</li>
                  <li>• Modals/Drawers: <code className="bg-muted px-1 rounded">z-[999]</code> - Above everything</li>
                </ul>
                <h4 className="font-medium mb-2">Header Position Offset</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Fixed headers must offset their <code className="bg-muted px-1 rounded">top</code> position to account for banners:
                </p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`// In fixed-layer.css
.fixed-header-sidebar-aware {
  top: calc(var(--email-banner-height, 0px) + var(--pwa-banner-height, 0px));
}`}
                </pre>
              </div>
            </StateDemo>

            <StateDemo label="Banner Design Guidelines">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">Visual Design</h4>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>• Uses <code className="bg-muted px-1 rounded">bg-muted/50</code> for glassmorphic background</li>
                  <li>• Consistent with card system styling and borders</li>
                  <li>• Mobile-first design with responsive breakpoints</li>
                  <li>• Smooth 300ms collapse/expand animations</li>
                </ul>
                <h4 className="font-medium mb-2">Dismissal Behavior</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong className="text-foreground">Later:</strong> Dismisses for 24 hours (email) or 3 days (username)</li>
                  <li>• <strong className="text-foreground">Don't remind:</strong> Permanently dismisses until condition changes</li>
                  <li>• Stored in localStorage with timestamp tracking</li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Adding New Banners">
              <div className="wewrite-card p-4 max-w-2xl">
                <h4 className="font-medium mb-2">Checklist for New Banners</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Add state to <code className="bg-muted px-1 rounded">BannerProvider</code> with priority logic</li>
                  <li>Create CSS variable: <code className="bg-muted px-1 rounded">--your-banner-height</code></li>
                  <li>Update <code className="bg-muted px-1 rounded">fixed-layer.css</code> to include new variable in calculations</li>
                  <li>Set the CSS variable when banner mounts/unmounts</li>
                  <li>Add localStorage keys for dismissal tracking</li>
                  <li>Update cascade logic in BannerProvider dismiss handlers</li>
                </ol>
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
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <CompositionBar
                        data={{ otherPagesPercentage: 15, currentPageFundedPercentage: 25, currentPageOverfundedPercentage: 0, availablePercentage: 60, isOutOfFunds: false }}
                        size="md"
                      />
                      <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                        <Plus className="h-4 w-4" />
                      </Button>
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

          {/* Loading States Section */}
          <ComponentShowcase
            title="Loading States"
            path="app/components/ui/LoadingState.tsx"
            description="Standardized loading states with multiple visual variants. Use for consistent loading experiences across the app."
          >
            <StateDemo label="Spinner Variants (default)">
              <div className="flex flex-wrap gap-8 items-end">
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="spinner" size="sm" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Small</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="spinner" size="md" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Medium</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="spinner" size="lg" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Large</span>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="With Message">
              <div className="flex flex-wrap gap-6">
                <div className="wewrite-card p-4 w-64">
                  <LoadingState variant="spinner" message="Loading..." minHeight="h-24" />
                </div>
                <div className="wewrite-card p-4 w-64">
                  <LoadingState variant="dots" message="Processing..." minHeight="h-24" />
                </div>
                <div className="wewrite-card p-4 w-64">
                  <LoadingState variant="pulse" message="Connecting..." minHeight="h-24" />
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Dots Variant">
              <div className="flex flex-wrap gap-8 items-end">
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="dots" size="sm" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Small</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="dots" size="md" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Medium</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="dots" size="lg" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Large</span>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Pulse Variant">
              <div className="flex flex-wrap gap-8 items-end">
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="pulse" size="sm" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Small</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="pulse" size="md" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Medium</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LoadingState variant="pulse" size="lg" minHeight="h-16" />
                  <span className="text-xs text-muted-foreground">Large</span>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Skeleton Variant">
              <div className="wewrite-card p-4 max-w-sm">
                <LoadingState variant="skeleton" minHeight="h-auto" />
              </div>
            </StateDemo>

            <StateDemo label="Inline Components">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">LoadingSpinner</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoadingDots />
                  <span className="text-sm">LoadingDots</span>
                </div>
                <Button disabled>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </Button>
              </div>
            </StateDemo>

            <StateDemo label="Skeleton Components">
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <SkeletonLine width="w-3/4" />
                  <SkeletonLine width="w-full" />
                  <SkeletonLine width="w-1/2" />
                </div>
                <SkeletonCard />
              </div>
            </StateDemo>

            <StateDemo label="Real-World Example">
              <div className="wewrite-card p-6 w-full max-w-md">
                <h3 className="text-sm font-medium mb-4">Page Connections</h3>
                <LoadingState
                  variant="spinner"
                  message="Loading page connections..."
                  minHeight="h-32"
                />
              </div>
            </StateDemo>

            <StateDemo label="Code Usage">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
                <pre className="text-xs overflow-x-auto">
{`// Full loading state with card
<LoadingState
  variant="spinner" // 'spinner' | 'dots' | 'pulse' | 'skeleton'
  size="md"         // 'sm' | 'md' | 'lg'
  message="Loading..."
  showCard={true}
  minHeight="h-64"
/>

// Inline spinner (e.g., in buttons)
<Button disabled>
  <LoadingSpinner size="sm" className="mr-2" />
  Saving...
</Button>

// Skeleton placeholders
<SkeletonLine width="w-3/4" />
<SkeletonCard />`}
                </pre>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Full Page Error Section */}
          <ComponentShowcase
            title="Full Page Error"
            path="app/components/ui/FullPageError.tsx"
            description="Full-screen error page shown when critical errors occur. Includes action buttons, collapsible error details, and copy-to-clipboard functionality."
          >
            <StateDemo label="Preview">
              <Button onClick={() => setShowFullPageError(true)}>
                Show Full Page Error
              </Button>
            </StateDemo>

            <StateDemo label="Inline Preview (Scaled)">
              <div className="w-full border rounded-lg overflow-hidden bg-background">
                <div className="transform scale-75 origin-top" style={{ height: '400px' }}>
                  <div className="min-h-full flex flex-col items-center justify-center p-4 bg-background">
                    <div className="max-w-md w-full wewrite-card p-8 rounded-lg shadow-lg text-center">
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>

                      <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
                      <p className="text-lg text-muted-foreground mb-8">We&apos;re sorry, but there was an error loading this page.</p>

                      <div className="flex flex-col gap-4 mb-6">
                        <Button size="lg" className="gap-2 w-full">
                          <RefreshCw className="h-5 w-5" />
                          Try again
                        </Button>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <Button size="lg" className="gap-2 w-full sm:w-1/2">
                            <Home className="h-5 w-5" />
                            Back to Home
                          </Button>

                          <Button variant="secondary" size="lg" className="gap-2 w-full sm:w-1/2">
                            <ArrowLeft className="h-5 w-5" />
                            Go Back
                          </Button>
                        </div>
                      </div>

                      <Button variant="secondary" className="w-full flex items-center justify-between p-4">
                        <span>Error Details</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Props">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl space-y-2">
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><code className="bg-muted px-1 rounded">error</code> - Error object with message, stack, and optional digest</li>
                  <li><code className="bg-muted px-1 rounded">reset</code> - Function to reset the error boundary</li>
                  <li><code className="bg-muted px-1 rounded">title</code> - Custom title (default: &quot;Something went wrong&quot;)</li>
                  <li><code className="bg-muted px-1 rounded">message</code> - Custom message</li>
                  <li><code className="bg-muted px-1 rounded">showGoBack</code> - Show &quot;Go Back&quot; button (default: true)</li>
                  <li><code className="bg-muted px-1 rounded">showGoHome</code> - Show &quot;Back to Home&quot; button (default: true)</li>
                  <li><code className="bg-muted px-1 rounded">showTryAgain</code> - Show &quot;Try Again&quot; button (default: true)</li>
                  <li><code className="bg-muted px-1 rounded">onRetry</code> - Custom retry function</li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Code Usage">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
                <pre className="text-xs overflow-x-auto">
{`// In error.tsx or error boundary
import FullPageError from '@/components/ui/FullPageError';

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FullPageError
      error={error}
      reset={reset}
      title="Page Error"
      message="This page encountered an unexpected error."
      showGoBack={true}
      showGoHome={true}
      showTryAgain={true}
    />
  );
}`}
                </pre>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Full Page Error Modal */}
          {showFullPageError && (
            <div className="fixed inset-0 z-50">
              <div className="absolute top-4 right-4 z-50">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFullPageError(false)}
                  className="shadow-lg"
                >
                  <X className="h-4 w-4 mr-2" />
                  Close Demo
                </Button>
              </div>
              <FullPageError
                error={new Error("This is a demo error message for testing purposes. The component displays error details, provides action buttons, and allows copying error info to clipboard.")}
                title="Something went wrong"
                message="We're sorry, but there was an error loading this page."
                onRetry={() => setShowFullPageError(false)}
              />
            </div>
          )}

          {/* Drawers & Modals Section */}
          <ComponentShowcase
            title="Drawers & Modals"
            path="app/components/ui/drawer.tsx & app/components/ui/dialog.tsx"
            description="Test drawer and modal styling. Both should have solid opaque backgrounds (not semi-transparent like cards) for proper light/dark mode support."
          >
            <StateDemo label="Overlay Options">
              <div className="flex flex-wrap gap-6 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={overlayDark} onCheckedChange={setOverlayDark} />
                  <span className="text-sm">Dark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={overlayBlur} onCheckedChange={setOverlayBlur} />
                  <span className="text-sm">Blur</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {overlayDark && overlayBlur ? 'Dark + Blur' :
                   overlayDark ? 'Dark only' :
                   overlayBlur ? 'Blur only' : 'No overlay'}
                </span>
              </div>
            </StateDemo>

            <StateDemo label="Open Test Components">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowDialog(true)}>
                  Open Dialog
                </Button>
                <Button onClick={() => setShowDrawer(true)} variant="outline">
                  Open Drawer
                </Button>
                <Button onClick={() => setShowDrawerWithForm(true)} variant="secondary">
                  Drawer with Form
                </Button>
              </div>
            </StateDemo>

            <StateDemo label="Styling Notes">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl space-y-2">
                <p className="text-sm"><strong>Overlay Props (combinable):</strong></p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><code className="bg-muted px-1 rounded">showOverlay=&#123;true&#125;</code> - Dark semi-transparent (bg-black/50)</li>
                  <li><code className="bg-muted px-1 rounded">blurOverlay=&#123;true&#125;</code> - Adds backdrop blur (backdrop-blur-sm)</li>
                  <li>Both can be combined for dark + blur effect</li>
                </ul>
                <p className="text-sm mt-3"><strong>Content Styling:</strong></p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>High opacity: <code className="bg-muted px-1 rounded">bg-white/95 dark:bg-zinc-900/95</code></li>
                  <li>Backdrop blur: <code className="bg-muted px-1 rounded">backdrop-blur-xl</code></li>
                  <li>Border & shadow: <code className="bg-muted px-1 rounded">border border-border shadow-lg</code></li>
                </ul>
              </div>
            </StateDemo>

            <StateDemo label="Code Usage">
              <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
                <pre className="text-xs overflow-x-auto">
{`// Drawer Usage
<Drawer open={isOpen} onOpenChange={setIsOpen}>
  <DrawerContent
    height="auto"
    showOverlay={true}  // dark tint (default)
    blurOverlay={false} // backdrop blur
  >
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Description</DrawerDescription>
    </DrawerHeader>
    <div className="px-4 pb-4">Content</div>
    <DrawerFooter className="flex-row gap-2">
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>

// Dialog Usage
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent
    showOverlay={true}  // dark tint (default)
    blurOverlay={false} // backdrop blur
  >
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    Content
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
                </pre>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Tabs */}
          <ComponentShowcase
            title="Tabs"
            path="app/components/ui/tabs.tsx"
            description="Simple tabs for switching between content sections. Underline style indicates active tab."
          >
            <StateDemo label="Basic Tabs">
              <div className="w-full">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full justify-start gap-4 bg-transparent p-0">
                    <TabsTrigger value="tab1">Overview</TabsTrigger>
                    <TabsTrigger value="tab2">Analytics</TabsTrigger>
                    <TabsTrigger value="tab3">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">Overview content goes here. This is the first tab.</p>
                  </TabsContent>
                  <TabsContent value="tab2" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">Analytics content goes here. This is the second tab.</p>
                  </TabsContent>
                  <TabsContent value="tab3" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">Settings content goes here. This is the third tab.</p>
                  </TabsContent>
                </Tabs>
              </div>
            </StateDemo>

            <StateDemo label="Tabs with Icons">
              <div className="w-full">
                <Tabs defaultValue="users">
                  <TabsList className="w-full justify-start gap-4 bg-transparent p-0">
                    <TabsTrigger value="users" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Users
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </TabsTrigger>
                    <TabsTrigger value="mail" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Mail
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="users" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">Manage users and permissions.</p>
                  </TabsContent>
                  <TabsContent value="settings" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">Configure application settings.</p>
                  </TabsContent>
                  <TabsContent value="mail" className="p-4 border rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">View and manage email notifications.</p>
                  </TabsContent>
                </Tabs>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Segmented Control */}
          <ComponentShowcase
            title="Segmented Control"
            path="app/components/ui/segmented-control.tsx"
            description="iOS-style segmented control for switching between mutually exclusive options. Filled style indicates active segment."
          >
            <StateDemo label="Basic Segmented Control">
              <div className="w-full max-w-md">
                <SegmentedControl value={activeSegment} onValueChange={setActiveSegment}>
                  <SegmentedControlList>
                    <SegmentedControlTrigger value="segment1">Day</SegmentedControlTrigger>
                    <SegmentedControlTrigger value="segment2">Week</SegmentedControlTrigger>
                    <SegmentedControlTrigger value="segment3">Month</SegmentedControlTrigger>
                  </SegmentedControlList>
                  <SegmentedControlContent value="segment1">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Showing daily view data</p>
                    </div>
                  </SegmentedControlContent>
                  <SegmentedControlContent value="segment2">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Showing weekly view data</p>
                    </div>
                  </SegmentedControlContent>
                  <SegmentedControlContent value="segment3">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Showing monthly view data</p>
                    </div>
                  </SegmentedControlContent>
                </SegmentedControl>
              </div>
            </StateDemo>

            <StateDemo label="With Icons">
              <div className="w-full max-w-md">
                <SegmentedControl defaultValue="grid">
                  <SegmentedControlList>
                    <SegmentedControlTrigger value="list" className="flex items-center gap-1">
                      <Type className="h-4 w-4" />
                      <span className="hidden sm:inline">List</span>
                    </SegmentedControlTrigger>
                    <SegmentedControlTrigger value="grid" className="flex items-center gap-1">
                      <Palette className="h-4 w-4" />
                      <span className="hidden sm:inline">Grid</span>
                    </SegmentedControlTrigger>
                  </SegmentedControlList>
                </SegmentedControl>
              </div>
            </StateDemo>

            <StateDemo label="Two Options">
              <div className="w-full max-w-xs">
                <SegmentedControl defaultValue="active">
                  <SegmentedControlList>
                    <SegmentedControlTrigger value="active">Active</SegmentedControlTrigger>
                    <SegmentedControlTrigger value="inactive">Inactive</SegmentedControlTrigger>
                  </SegmentedControlList>
                </SegmentedControl>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Alert Banners */}
          <ComponentShowcase
            title="Alert"
            path="@/components/ui/alert"
            description="Alert banners for displaying important messages with different severity levels. Supports dark mode."
          >
            <StateDemo label="All Variants">
              <div className="w-full space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Default alert for general information messages.
                  </AlertDescription>
                </Alert>

                <Alert variant="info">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Info alert for helpful tips and guidance.
                  </AlertDescription>
                </Alert>

                <Alert variant="success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Success alert for confirmations and completed actions.
                  </AlertDescription>
                </Alert>

                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Warning alert for important notices that need attention.
                  </AlertDescription>
                </Alert>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Destructive alert for errors and critical issues.
                  </AlertDescription>
                </Alert>
              </div>
            </StateDemo>

            <StateDemo label="With Title">
              <div className="w-full space-y-3">
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Subscription Inactive</AlertTitle>
                  <AlertDescription>
                    Your subscription is currently inactive. Reactivate to continue using premium features.
                  </AlertDescription>
                </Alert>
              </div>
            </StateDemo>

            <StateDemo label="With Action Button">
              <div className="w-full">
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                    <span>Your subscription is currently inactive.</span>
                    <Button variant="default" size="sm" className="shrink-0 w-full sm:w-auto">
                      Reactivate Subscription
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Borders & Separators */}
          <ComponentShowcase
            title="Borders & Separators"
            path="Tailwind CSS classes"
            description="Border and separator patterns for visual hierarchy and content organization. Use border-border for standard borders that adapt to theme."
          >
            {/* Documentation */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <h4 className="font-semibold text-sm">Usage Guidelines</h4>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p><code className="bg-muted px-1 py-0.5 rounded text-xs">border-border</code> - Standard border color that adapts to light/dark theme. Use for card edges, dividers, and input borders.</p>
                <p><code className="bg-muted px-1 py-0.5 rounded text-xs">border-b border-border</code> - Bottom border for horizontal separators between sections.</p>
                <p><code className="bg-muted px-1 py-0.5 rounded text-xs">divide-y divide-border</code> - Apply to parent to add borders between child elements (great for lists).</p>
                <p><code className="bg-muted px-1 py-0.5 rounded text-xs">ring-1 ring-border</code> - Subtle outline effect, useful for focus states or grouping.</p>
              </div>
            </div>

            <StateDemo label="Horizontal Separators">
              <div className="w-full space-y-4">
                {/* Standard hr */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Standard &lt;hr /&gt; element</p>
                  <hr className="border-border" />
                </div>

                {/* Border-bottom pattern */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">border-b border-border (on a div)</p>
                  <div className="border-b border-border pb-4">
                    <p className="text-sm">Content above the separator</p>
                  </div>
                  <p className="text-sm pt-2">Content below the separator</p>
                </div>

                {/* Dashed border */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">border-b border-dashed border-border</p>
                  <div className="border-b border-dashed border-border pb-4">
                    <p className="text-sm">Dashed separator - useful for less prominent divisions</p>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Card Borders">
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Standard border */}
                <div className="p-4 border border-border rounded-lg">
                  <p className="text-sm font-medium">border border-border rounded-lg</p>
                  <p className="text-xs text-muted-foreground mt-1">Standard card border</p>
                </div>

                {/* Ring border */}
                <div className="p-4 ring-1 ring-border rounded-lg">
                  <p className="text-sm font-medium">ring-1 ring-border rounded-lg</p>
                  <p className="text-xs text-muted-foreground mt-1">Ring border (sharper)</p>
                </div>

                {/* Double border effect */}
                <div className="p-4 border-2 border-border rounded-lg">
                  <p className="text-sm font-medium">border-2 border-border</p>
                  <p className="text-xs text-muted-foreground mt-1">Thicker border for emphasis</p>
                </div>

                {/* Shadow + border */}
                <div className="p-4 border border-border rounded-lg shadow-sm">
                  <p className="text-sm font-medium">border + shadow-sm</p>
                  <p className="text-xs text-muted-foreground mt-1">Combined for depth</p>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="List Dividers (divide-y)">
              <div className="w-full">
                <p className="text-xs text-muted-foreground mb-2">Apply divide-y divide-border to parent element</p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  <div className="p-3">
                    <p className="text-sm font-medium">List Item 1</p>
                    <p className="text-xs text-muted-foreground">Description text</p>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">List Item 2</p>
                    <p className="text-xs text-muted-foreground">Description text</p>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">List Item 3</p>
                    <p className="text-xs text-muted-foreground">Description text</p>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Section Header Pattern">
              <div className="w-full space-y-4">
                {/* Pattern 1: Border below header */}
                <div className="border-b border-border pb-4">
                  <h3 className="text-lg font-semibold">Section Title</h3>
                  <p className="text-sm text-muted-foreground">border-b border-border pb-4 on container</p>
                </div>

                {/* Pattern 2: Border with flex line */}
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold whitespace-nowrap">Section Title</h3>
                  <div className="flex-1 border-b border-border"></div>
                </div>

                {/* Pattern 3: Centered text divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Vertical Separators">
              <div className="w-full">
                <p className="text-xs text-muted-foreground mb-2">Use border-l or border-r for vertical dividers</p>
                <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold">24</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                  <div className="border-l border-border h-12"></div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold">128</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="border-l border-border h-12"></div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold">$42</p>
                    <p className="text-xs text-muted-foreground">Earned</p>
                  </div>
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Focus & Interactive States">
              <div className="w-full space-y-4">
                <p className="text-xs text-muted-foreground">Borders for interactive elements</p>
                <div className="flex flex-wrap gap-4">
                  <div className="p-4 border border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
                    <p className="text-sm">hover:border-primary</p>
                  </div>
                  <div className="p-4 border-2 border-primary rounded-lg">
                    <p className="text-sm">border-2 border-primary (selected)</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg ring-2 ring-primary ring-offset-2">
                    <p className="text-sm">ring-2 ring-primary ring-offset-2</p>
                  </div>
                </div>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Table Component */}
          <ComponentShowcase
            title="Table"
            path="app/components/ui/table.tsx"
            description="Data table component with proper border styling using border-theme-strong class"
          >
            <StateDemo label="Basic Table">
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Alice Johnson</TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">$250.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Bob Smith</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
                      </TableCell>
                      <TableCell className="text-right">$150.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Carol White</TableCell>
                      <TableCell>
                        <Badge variant="outline">Inactive</Badge>
                      </TableCell>
                      <TableCell className="text-right">$350.00</TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right font-bold">$750.00</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </StateDemo>

            <StateDemo label="Border Classes">
              <div className="space-y-2 text-sm">
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">border-theme-strong</code>
                  <span className="text-muted-foreground">- For header/footer rows (60% opacity)</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">border-b border-border</code>
                  <span className="text-muted-foreground">- For body rows (uses --border variable)</span>
                </div>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Empty State Component */}
          <ComponentShowcase
            title="Empty State"
            path="app/components/ui/EmptyState.tsx"
            description="Standardized empty state component for consistent messaging when content is unavailable"
          >
            <StateDemo label="Size Variants">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Small (sm)</p>
                  <EmptyState
                    icon={Tags}
                    title="No alternative titles"
                    description="Add alternative titles to help people find this page."
                    size="sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Medium (md) - Default</p>
                  <EmptyState
                    icon={Inbox}
                    title="No messages"
                    description="When you receive messages, they'll appear here."
                    size="md"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Large (lg)</p>
                  <EmptyState
                    icon={FolderOpen}
                    title="No pages yet"
                    description="Create your first page to get started with WeWrite."
                    size="lg"
                  />
                </div>
              </div>
            </StateDemo>

            <StateDemo label="Common Use Cases">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <EmptyState
                  icon={FileText}
                  title="No recent activity"
                  description="Your recent edits and activity will show up here."
                  size="sm"
                />
                <EmptyState
                  icon={Users}
                  title="No followers yet"
                  description="When people follow you, they'll appear in this list."
                  size="sm"
                />
              </div>
            </StateDemo>

            <StateDemo label="Props">
              <div className="space-y-2 text-sm w-full">
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">icon: LucideIcon</code>
                  <span className="text-muted-foreground">- Required. Icon component from lucide-react</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">title: string</code>
                  <span className="text-muted-foreground">- Required. Main heading text</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">description: string</code>
                  <span className="text-muted-foreground">- Required. Supporting description text</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">size?: 'sm' | 'md' | 'lg'</code>
                  <span className="text-muted-foreground">- Optional. Controls padding and text size (default: 'md')</span>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="px-2 py-1 bg-muted rounded text-xs">className?: string</code>
                  <span className="text-muted-foreground">- Optional. Additional CSS classes</span>
                </div>
              </div>
            </StateDemo>
          </ComponentShowcase>

          {/* Allocation Bar */}
          <AllocationBarShowcase />

          {/* Test Dialog - uses switch state */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent showOverlay={overlayDark} blurOverlay={overlayBlur}>
              <DialogHeader>
                <DialogTitle>Test Dialog</DialogTitle>
                <DialogDescription>
                  {overlayDark && overlayBlur ? 'Dark + Blur overlay' :
                   overlayDark ? 'Dark overlay (default)' :
                   overlayBlur ? 'Blur only overlay' : 'No overlay'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  95% white opacity + backdrop-blur-xl creates a clean, modern look.
                </p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">Sample content area with muted background</p>
                </div>
                <Input placeholder="Test input field..." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button onClick={() => setShowDialog(false)}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Test Drawer - uses switch state */}
          <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
            <DrawerContent height="auto" showOverlay={overlayDark} blurOverlay={overlayBlur}>
              <DrawerHeader className="text-center">
                <DrawerTitle>Test Drawer</DrawerTitle>
                <DrawerDescription>
                  {overlayDark && overlayBlur ? 'Dark + Blur overlay' :
                   overlayDark ? 'Dark overlay (default)' :
                   overlayBlur ? 'Blur only overlay' : 'No overlay'}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  95% white opacity + backdrop-blur-xl creates a clean, modern look.
                </p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">Sample content area with muted background</p>
                </div>
              </div>
              <DrawerFooter className="flex-row gap-2">
                <Button variant="outline" onClick={() => setShowDrawer(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setShowDrawer(false)} className="flex-1">
                  Confirm
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          {/* Test Drawer with Form - proper header/body/footer structure */}
          <Drawer open={showDrawerWithForm} onOpenChange={setShowDrawerWithForm}>
            <DrawerContent height="70vh">
              <DrawerHeader>
                <DrawerTitle>Drawer with Form</DrawerTitle>
                <DrawerDescription>
                  Test scrollable body with fixed header and footer
                </DrawerDescription>
                <DrawerClose className="absolute right-4 top-1 p-2 rounded-full opacity-70 hover:opacity-100 hover:bg-muted">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DrawerClose>
              </DrawerHeader>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Search for something..."
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    placeholder="https://example.com"
                    leftIcon={<Globe className="h-4 w-4" />}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Enable feature</label>
                  <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
                </div>
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <PillLink href="#" clickable={false}>Sample Link</PillLink>
                </div>

                {/* Extra content to test scrolling */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Additional Field 1</label>
                  <Input placeholder="More content..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Additional Field 2</label>
                  <Input placeholder="Even more content..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Additional Field 3</label>
                  <Input placeholder="Scroll to see footer..." />
                </div>
              </div>

              {/* Fixed footer */}
              <DrawerFooter className="flex-row gap-2">
                <Button variant="outline" onClick={() => setShowDrawerWithForm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setShowDrawerWithForm(false)} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
}
