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
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { isAdmin } from '../../utils/isAdmin';
import ColorSystemManager from '@/components/settings/ColorSystemManager';
import ThemeToggle from '@/components/utils/ThemeToggle';
import VerifyEmailBanner from '../../components/utils/VerifyEmailBanner';
import PWABanner from '../../components/utils/PWABanner';
import PillLink from '../../components/utils/PillLink';

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

          {/* Buttons */}
          <ComponentShowcase
            title="Button"
            path="app/components/ui/button.tsx"
            description="Primary interactive element with multiple variants and states"
          >
            <StateDemo label="Primary Variants">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
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
              <Button size="icon"><Settings className="h-4 w-4" /></Button>
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
            description="Compact icon-only buttons with enhanced interactive states"
          >
            <StateDemo label="Primary Variants">
              <IconButton variant="default"><Settings className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Search className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><User className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Mail className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Heart className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Star className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Plus className="h-4 w-4" /></IconButton>
              <IconButton variant="default"><Check className="h-4 w-4" /></IconButton>
            </StateDemo>

            <StateDemo label="Variants">
              <IconButton variant="default"><Settings className="h-4 w-4" /></IconButton>
              <IconButton variant="destructive"><X className="h-4 w-4" /></IconButton>
              <IconButton variant="secondary"><Search className="h-4 w-4" /></IconButton>
              <IconButton variant="ghost"><Heart className="h-4 w-4" /></IconButton>
              <IconButton variant="link"><Star className="h-4 w-4" /></IconButton>
            </StateDemo>

            <StateDemo label="Sizes">
              <IconButton size="sm"><Settings className="h-3 w-3" /></IconButton>
              <IconButton size="default"><Settings className="h-4 w-4" /></IconButton>
              <IconButton size="lg"><Settings className="h-5 w-5" /></IconButton>
            </StateDemo>

            <StateDemo label="States">
              <IconButton><Settings className="h-4 w-4" /></IconButton>
              <IconButton disabled><Settings className="h-4 w-4" /></IconButton>
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

          {/* Badges */}
          <ComponentShowcase
            title="Badge"
            path="app/components/ui/badge.tsx"
            description="Small status indicators and labels"
          >
            <StateDemo label="Variants">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="destructive">Destructive</Badge>
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

          {/* PillLink Components */}
          <ComponentShowcase
            title="PillLink Components"
            path="app/components/utils/PillLink.tsx"
            description="Interactive pill-shaped links used throughout the application for pages, users, and external links"
          >
            <StateDemo label="Page Links">
              <div className="flex flex-wrap gap-2">
                <PillLink href="/example-page" pageId="example123">Normal Page</PillLink>
                <PillLink href="/example-page" pageId="example123" isOwned={true}>Owned Page</PillLink>
                <PillLink href="/example-page" pageId="example123" isPublic={true}>Public Page</PillLink>
                <PillLink href="/example-page" pageId="example123" isLoading={true}>Loading Page</PillLink>
              </div>
            </StateDemo>

            <StateDemo label="User Links">
              <div className="flex flex-wrap gap-2">
                <PillLink href="/user/example">@username</PillLink>
                <PillLink href="/user/example" byline="Author">@author</PillLink>
              </div>
            </StateDemo>

            <StateDemo label="External Links">
              <div className="flex flex-wrap gap-2">
                <PillLink href="https://example.com">External Link</PillLink>
                <PillLink href="https://github.com">GitHub</PillLink>
              </div>
            </StateDemo>

            <StateDemo label="Special States">
              <div className="flex flex-wrap gap-2">
                <PillLink href="/deleted-page" deleted={true}>Deleted Page</PillLink>
                <PillLink href="/fallback-page" isFallback={true}>Fallback Link</PillLink>
                <PillLink href="/suggestion" isSuggestion={true}>Link Suggestion</PillLink>
              </div>
            </StateDemo>

            <StateDemo label="Group Links">
              <div className="flex flex-wrap gap-2">
                <PillLink href="/group/example" groupId="group123">Group Page</PillLink>
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
        </div>
      </div>
    </div>
  );
}
