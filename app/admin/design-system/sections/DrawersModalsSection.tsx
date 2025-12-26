"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '../../../components/ui/drawer';
import { SideDrawer, SideDrawerContent, SideDrawerHeader, SideDrawerBody, SideDrawerFooter, SideDrawerTitle, SideDrawerDescription } from '../../../components/ui/side-drawer';
import { DrawerNavigationStack, ANIMATION_DURATION } from '../../../components/ui/drawer-navigation-stack';
import PillLink from '../../../components/utils/PillLink';
import { ComponentShowcase, StateDemo } from './shared';
import { cn } from '../../../lib/utils';

// Demo menu items for navigation stack demo
const DEMO_SECTIONS = [
  { id: 'profile', title: 'Profile', icon: 'User' as const },
  { id: 'appearance', title: 'Appearance', icon: 'Palette' as const },
  { id: 'notifications', title: 'Notifications', icon: 'Bell' as const },
  { id: 'fund-account', title: 'Fund Account', icon: 'DollarSign' as const },
  { id: 'earnings', title: 'Earnings', icon: 'TrendingUp' as const },
];

// Animated header component that syncs with DrawerNavigationStack
// - Root view: Centered title
// - Detail view: Left-aligned ghost back button + centered page title
function AnimatedHeader({
  activeSection,
  onBack,
  rootTitle,
}: {
  activeSection: typeof DEMO_SECTIONS[number] | null;
  onBack: () => void;
  rootTitle: string;
}) {
  const isDetail = activeSection !== null;

  return (
    <DrawerHeader className="relative overflow-hidden">
      {/* Container for animating headers */}
      <div className="relative h-10 flex items-center justify-center">
        {/* Root title - centered */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all ease-out",
            isDetail ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          <DrawerTitle>{rootTitle}</DrawerTitle>
        </div>

        {/* Detail header - back button left, title centered */}
        <div
          className={cn(
            "absolute inset-0 flex items-center transition-all ease-out",
            isDetail ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          {/* Left-aligned ghost back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 -ml-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Icon name="ChevronLeft" size={18} />
            <span className="text-sm font-medium">{rootTitle}</span>
          </button>

          {/* Centered page title */}
          <DrawerTitle className="flex-1 text-center pr-[88px]">{activeSection?.title}</DrawerTitle>
        </div>
      </div>
    </DrawerHeader>
  );
}

export function DrawersModalsSection({ id }: { id: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showDrawerWithForm, setShowDrawerWithForm] = useState(false);
  const [showSideDrawerLeft, setShowSideDrawerLeft] = useState(false);
  const [showSideDrawerRight, setShowSideDrawerRight] = useState(false);
  const [showSideDrawerWithForm, setShowSideDrawerWithForm] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [settingsActiveSection, setSettingsActiveSection] = useState<string | null>(null);
  const [sideDrawerSize, setSideDrawerSize] = useState<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('md');
  const [overlayDark, setOverlayDark] = useState(true);
  const [overlayBlur, setOverlayBlur] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);

  return (
    <ComponentShowcase
      id={id}
      title="Drawers & Modals"
      path="app/components/ui/drawer.tsx, app/components/ui/side-drawer.tsx & app/components/ui/dialog.tsx"
      description="WeWrite has three drawer/modal types: Bottom Drawer (mobile-first, slides up), Side Drawer (slides from left/right for detail views), and Dialog (centered modal). All have frosted glass backgrounds."
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

      {/* Drawer Type Comparison */}
      <StateDemo label="Drawer Types Comparison">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="wewrite-card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="ArrowUp" size={16} className="text-blue-500" />
              <h4 className="font-semibold">Bottom Drawer</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Mobile-first drawer that slides up from bottom. Has drag handle for swipe-to-dismiss.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Best for: Quick actions, confirmations, forms</li>
              <li>• Mobile: Primary choice</li>
              <li>• Desktop: Works but prefer Dialog</li>
            </ul>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="ArrowRight" size={16} className="text-purple-500" />
              <h4 className="font-semibold">Side Drawer</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Full-height panel that slides from left/right. Ideal for detail views and editing.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Best for: Detail views, user profiles, editing</li>
              <li>• Mobile: Avoid (use bottom drawer)</li>
              <li>• Desktop: Excellent for admin panels</li>
            </ul>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-green-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Square" size={16} className="text-green-500" />
              <h4 className="font-semibold">Dialog (Modal)</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Centered modal for important decisions or focused content.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Best for: Confirmations, alerts, focused tasks</li>
              <li>• Mobile: Use sparingly</li>
              <li>• Desktop: Great for quick decisions</li>
            </ul>
          </div>
        </div>
      </StateDemo>

      {/* Bottom Drawer & Dialog */}
      <StateDemo label="Bottom Drawer & Dialog">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowDialog(true)}>
            Open Dialog
          </Button>
          <Button onClick={() => setShowDrawer(true)} variant="outline">
            Open Bottom Drawer
          </Button>
          <Button onClick={() => setShowDrawerWithForm(true)} variant="secondary">
            Bottom Drawer + Form
          </Button>
        </div>
      </StateDemo>

      {/* DrawerNavigationStack - Sub-Page Navigation */}
      <StateDemo label="DrawerNavigationStack (iOS-Style Sub-Page Navigation)">
        <div className="space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-orange-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Layers" size={16} className="text-orange-500" />
              <h4 className="font-semibold">DrawerNavigationStack</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Reusable iOS-like navigation stack for bottom drawers. Provides smooth sliding
              transitions between root menu and detail views with animated breadcrumb headers.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Best for: Settings, multi-level menus, mobile navigation</li>
              <li>• Animated header with tappable breadcrumb to go back</li>
              <li>• Synced 250ms slide animations for content and header</li>
              <li>• Used in: SettingsDrawer, potentially other drawers</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowSettingsDrawer(true)}>
              <Icon name="Layers" size={16} className="mr-2" />
              Open Navigation Stack Demo
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSettingsActiveSection('appearance');
                setShowSettingsDrawer(true);
              }}
            >
              <Icon name="Palette" size={16} className="mr-2" />
              Open to "Appearance"
            </Button>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-3xl">
            <p className="text-sm font-medium mb-2">Animated Header Pattern</p>
            <pre className="text-xs overflow-x-auto">
{`// Header animates in sync with content using ANIMATION_DURATION
// - Root view: Centered title
// - Detail view: Left-aligned ghost back button + centered page title
function AnimatedHeader({ activeSection, onBack, rootTitle }) {
  const isDetail = activeSection !== null;
  return (
    <DrawerHeader className="relative overflow-hidden">
      <div className="relative h-10 flex items-center justify-center">
        {/* Root title - centered, slides out left */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all",
          isDetail ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
        )} style={{ transitionDuration: ANIMATION_DURATION + 'ms' }}>
          <h2>{rootTitle}</h2>
        </div>
        {/* Detail: back button left, title centered */}
        <div className={cn(
          "absolute inset-0 flex items-center transition-all",
          isDetail ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        )} style={{ transitionDuration: ANIMATION_DURATION + 'ms' }}>
          {/* Ghost back button */}
          <button onClick={onBack} className="flex items-center gap-1 px-3 py-2 -ml-3
            rounded-lg text-muted-foreground hover:bg-muted/50">
            <ChevronLeft /> {rootTitle}
          </button>
          {/* Centered title with padding to offset button width */}
          <h2 className="flex-1 text-center pr-[88px]">{activeSection?.title}</h2>
        </div>
      </div>
    </DrawerHeader>
  );
}`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-3xl">
            <p className="text-sm font-medium mb-2">DrawerNavigationStack Usage</p>
            <pre className="text-xs overflow-x-auto">
{`import { DrawerNavigationStack, ANIMATION_DURATION } from '@/components/ui/drawer-navigation-stack';

<DrawerNavigationStack activeView={activeSection?.id || null}>
  {/* Root view: Menu list */}
  <DrawerNavigationStack.Root>
    <MenuList onItemClick={setActiveSection} />
  </DrawerNavigationStack.Root>

  {/* Detail view: Section content */}
  <DrawerNavigationStack.Detail>
    <SectionContent />
  </DrawerNavigationStack.Detail>
</DrawerNavigationStack>`}
            </pre>
          </div>
        </div>
      </StateDemo>

      {/* State-Driven Hash-Based Drawer Pattern */}
      <StateDemo label="State-Driven Drawer Navigation (Mobile)">
        <div className="space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Hash" size={16} className="text-emerald-500" />
              <h4 className="font-semibold">State-Driven Drawer with Hash Deep Links</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              WeWrite uses React state to control drawers on mobile, with hash fragments for deep linking.
              This preserves the underlying page content while the drawer overlays on top.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                Background content stays rendered (native mobile app feel)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                Hash deep links for sharing (#settings/profile)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                Browser back button closes drawer via hashchange
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                Analytics tracking via virtual pageviews
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                Header stays visible when drawer is open
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="wewrite-card p-4">
              <h5 className="font-medium mb-2 flex items-center gap-2">
                <Icon name="TabletSmartphone" size={16} />
                Mobile Behavior
              </h5>
              <p className="text-sm text-muted-foreground">
                Drawer opens as an overlay using React state. URL hash updates for deep linking
                (#settings/profile). Closing removes the hash and restores the original URL.
              </p>
            </div>
            <div className="wewrite-card p-4">
              <h5 className="font-medium mb-2 flex items-center gap-2">
                <Icon name="Monitor" size={16} />
                Desktop Behavior
              </h5>
              <p className="text-sm text-muted-foreground">
                Traditional path-based navigation (/settings, /admin).
                Full page layouts with sidebars render normally.
              </p>
            </div>
          </div>

          <div className="wewrite-card p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">Architecture Overview</p>
            <pre className="text-xs overflow-x-auto">
{`// GlobalDrawerProvider manages drawer state
// - drawerConfig: { type: 'settings' | 'admin', subPath: string | null }
// - openDrawer(type, subPath?) - opens drawer and pushes hash
// - closeDrawer() - closes drawer and removes hash
// - navigateInDrawer(subPath) - navigates within drawer

// Hash format: #settings, #settings/profile, #admin/users

// Usage in components:
const { openDrawer, drawerConfig, isGlobalDrawerActive } = useGlobalDrawer();

// Open settings drawer
<button onClick={() => openDrawer('settings')}>Settings</button>

// Open to specific section
<button onClick={() => openDrawer('settings', 'profile')}>Profile</button>`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">GlobalDrawerRenderer (Root Level)</p>
            <pre className="text-xs overflow-x-auto">
{`// Renders drawer overlay on mobile only
// Lives at root level (app/layout.tsx) to overlay any page

function GlobalDrawerRenderer() {
  const { drawerConfig, closeDrawer, isGlobalDrawerActive } = useGlobalDrawer();

  // Only render on mobile when drawer is open
  if (!isGlobalDrawerActive || !drawerConfig.type) return null;

  return (
    <>
      {/* Custom overlay that preserves header visibility */}
      <HeaderAwareOverlay isOpen={true} onClick={closeDrawer} />

      <Drawer open={true} onOpenChange={(open) => !open && closeDrawer()}>
        <DrawerContent height="85vh" showOverlay={false}>
          <DrawerNavigationStack activeView={drawerConfig.subPath}>
            <DrawerNavigationStack.Root>
              <MenuContent />
            </DrawerNavigationStack.Root>
            <DrawerNavigationStack.Detail>
              <SectionContent subPath={drawerConfig.subPath} />
            </DrawerNavigationStack.Detail>
          </DrawerNavigationStack>
        </DrawerContent>
      </Drawer>
    </>
  );
}`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              Why State + Hash Instead of Path Navigation?
            </p>
            <p className="text-sm text-muted-foreground">
              Path navigation (like /settings) causes Next.js to unmount the previous page,
              which removes the background content users expect to see. State-driven drawers
              keep the page rendered underneath, matching native iOS/Android behavior where
              modals overlay content without navigating away.
            </p>
          </div>

          <div className="wewrite-card p-4 bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
              Security Note: Desktop Uses Path Navigation
            </p>
            <p className="text-sm text-muted-foreground">
              On desktop, we use full path navigation (/admin/users) so middleware can
              enforce authentication. Hash fragments are only used on mobile where
              client-side auth checks are applied before rendering drawer content.
            </p>
          </div>

          <div className="wewrite-card p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">URL Examples</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-1 rounded">/home#settings</code> → Settings drawer on home (mobile)</li>
              <li><code className="bg-muted px-1 rounded">/home#settings/profile</code> → Settings drawer on profile section</li>
              <li><code className="bg-muted px-1 rounded">/[id]#admin</code> → Admin drawer over content page</li>
              <li><code className="bg-muted px-1 rounded">/[id]#admin/users</code> → Admin drawer on users section</li>
              <li><code className="bg-muted px-1 rounded">/settings</code> → Settings page (desktop only)</li>
              <li><code className="bg-muted px-1 rounded">/admin/users</code> → Admin users page (desktop only)</li>
            </ul>
          </div>
        </div>
      </StateDemo>

      {/* Secondary Sidebar Positioning */}
      <StateDemo label="Secondary Sidebar Positioning (Desktop)">
        <div className="space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-cyan-500">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="PanelLeftClose" size={16} className="text-cyan-500" />
              <h4 className="font-semibold">Avoiding Global Sidebar Collision</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Pages with their own sidebar (like Admin) must position it after the global navigation sidebar.
              Use the CSS variable <code className="bg-muted px-1 rounded">--sidebar-content-offset</code> which
              updates automatically when the global sidebar expands/collapses.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                <code className="bg-muted px-1 rounded">GLOBAL_SIDEBAR_WIDTHS.collapsed</code> = 72px
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                <code className="bg-muted px-1 rounded">GLOBAL_SIDEBAR_WIDTHS.expanded</code> = 256px
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-green-500" />
                <code className="bg-muted px-1 rounded">SECONDARY_SIDEBAR_LEFT_OFFSET</code> = CSS var reference
              </li>
            </ul>
          </div>

          <div className="wewrite-card p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">Secondary Sidebar Pattern</p>
            <pre className="text-xs overflow-x-auto">
{`import { SECONDARY_SIDEBAR_LEFT_OFFSET } from '@/constants/layout';
import { useSidebarContext } from '@/components/layout/DesktopSidebar';

function AdminLayoutInner({ children }) {
  const adminSidebarWidth = 256; // Your sidebar width

  // Subscribe to sidebar changes (CSS variable updates automatically)
  useSidebarContext();

  return (
    <div className="min-h-screen">
      {/* Fixed sidebar - positioned after global sidebar */}
      <aside
        className="fixed top-0 h-screen w-64 border-r bg-background hidden md:block"
        style={{
          left: SECONDARY_SIDEBAR_LEFT_OFFSET,
          top: 'var(--email-banner-height, 0px)',
          height: 'calc(100vh - var(--email-banner-height, 0px))',
        }}
      >
        {/* Sidebar content */}
      </aside>

      {/* Main content - offset by BOTH sidebars */}
      <main
        className="min-h-screen hidden md:block"
        style={{
          marginLeft: \`calc(\${SECONDARY_SIDEBAR_LEFT_OFFSET} + \${adminSidebarWidth}px)\`,
        }}
      >
        {children}
      </main>
    </div>
  );
}`}
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="wewrite-card p-4 bg-red-500/10 border border-red-500/30">
              <h5 className="font-medium mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                <Icon name="X" size={16} />
                Wrong: Fixed left: 0
              </h5>
              <p className="text-sm text-muted-foreground">
                Using <code className="bg-muted px-1 rounded">left: 0</code> causes the sidebar to overlap
                with the global navigation sidebar on desktop.
              </p>
            </div>
            <div className="wewrite-card p-4 bg-green-500/10 border border-green-500/30">
              <h5 className="font-medium mb-2 flex items-center gap-2 text-green-600 dark:text-green-400">
                <Icon name="Check" size={16} />
                Correct: CSS Variable
              </h5>
              <p className="text-sm text-muted-foreground">
                Using <code className="bg-muted px-1 rounded">left: var(--sidebar-content-offset)</code>
                positions the sidebar after the global nav and animates with it.
              </p>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Side Drawer */}
      <StateDemo label="Side Drawer">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">Size:</span>
            <div className="flex flex-wrap gap-2">
              {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
                <Button
                  key={size}
                  size="sm"
                  variant={sideDrawerSize === size ? 'default' : 'outline'}
                  onClick={() => setSideDrawerSize(size)}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowSideDrawerLeft(true)} variant="outline">
              <Icon name="PanelLeft" size={16} className="mr-2" />
              Open Left
            </Button>
            <Button onClick={() => setShowSideDrawerRight(true)} variant="outline">
              <Icon name="PanelRight" size={16} className="mr-2" />
              Open Right
            </Button>
            <Button onClick={() => setShowSideDrawerWithForm(true)} variant="secondary">
              Side Drawer + Form
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            <Badge variant="secondary-static" size="sm" className="mr-2">Current</Badge>
            Size: {sideDrawerSize} ({sideDrawerSize === 'sm' ? '320px' : sideDrawerSize === 'md' ? '400px' : sideDrawerSize === 'lg' ? '500px' : sideDrawerSize === 'xl' ? '600px' : '700px'})
          </div>
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
        <div className="space-y-4">
          <div className="wewrite-card p-4 bg-muted/30 max-w-3xl">
            <p className="text-sm font-medium mb-2">Bottom Drawer (mobile-first)</p>
            <pre className="text-xs overflow-x-auto">
{`import { Drawer, DrawerContent, DrawerHeader, DrawerTitle,
         DrawerDescription, DrawerFooter } from '@/components/ui/drawer';

<Drawer open={isOpen} onOpenChange={setIsOpen}>
  <DrawerContent height="auto" showOverlay={true} blurOverlay={false}>
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
</Drawer>`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-3xl">
            <p className="text-sm font-medium mb-2">Side Drawer (desktop detail views)</p>
            <pre className="text-xs overflow-x-auto">
{`import { SideDrawer, SideDrawerContent, SideDrawerHeader,
         SideDrawerBody, SideDrawerFooter, SideDrawerTitle,
         SideDrawerDescription } from '@/components/ui/side-drawer';

<SideDrawer open={isOpen} onOpenChange={setIsOpen}>
  <SideDrawerContent
    side="right"      // "left" | "right"
    size="md"         // "sm" | "md" | "lg" | "xl" | "2xl"
    showOverlay={true}
  >
    <SideDrawerHeader sticky showClose>
      <SideDrawerTitle>User Details</SideDrawerTitle>
      <SideDrawerDescription>View and edit user</SideDrawerDescription>
    </SideDrawerHeader>
    <SideDrawerBody>
      {/* Scrollable content */}
    </SideDrawerBody>
    <SideDrawerFooter sticky>
      <Button variant="outline">Cancel</Button>
      <Button>Save</Button>
    </SideDrawerFooter>
  </SideDrawerContent>
</SideDrawer>`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-3xl">
            <p className="text-sm font-medium mb-2">Dialog (centered modal)</p>
            <pre className="text-xs overflow-x-auto">
{`import { Dialog, DialogContent, DialogHeader, DialogTitle,
         DialogDescription, DialogFooter } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent showOverlay={true} blurOverlay={false}>
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
        </div>
      </StateDemo>

      {/* Test Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent showOverlay={overlayDark} blurOverlay={overlayBlur} className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>
              {overlayDark && overlayBlur ? 'Dark + Blur overlay' :
               overlayDark ? 'Dark overlay (default)' :
               overlayBlur ? 'Blur only overlay' : 'No overlay'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="py-4">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                95% white opacity + backdrop-blur-xl creates a clean, modern look.
                The dialog slides up with a subtle animation when opening.
              </p>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Animation Details</p>
                <p className="text-sm text-muted-foreground">
                  The dialog uses a combination of fade-in, slide-up (from bottom-8),
                  and zoom-in (from 95%) for a polished entrance.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Test Input</label>
                <Input placeholder="Type something here..." />
              </div>

              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Scrollable Content Test</p>
                <p className="text-sm text-muted-foreground">
                  This dialog has a max-height of 80vh, so if content exceeds that,
                  the body becomes scrollable while header and footer stay fixed.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Key Features:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Centered positioning with smooth animation</li>
                  <li>Frosted glass background effect</li>
                  <li>Optional dark overlay and blur</li>
                  <li>Accessible with proper focus management</li>
                  <li>URL hash tracking support</li>
                </ul>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">When to Use Dialogs</p>
                <p className="text-sm text-muted-foreground">
                  Dialogs are best for confirmations, alerts, and focused tasks that
                  require immediate attention. They block interaction with the
                  underlying page until dismissed.
                </p>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">Scroll Test</p>
                <p className="text-sm text-muted-foreground">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
                  ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Another Input</label>
                <Input placeholder="More input fields..." />
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">Final Section</p>
                <p className="text-sm text-muted-foreground">
                  This section ensures the dialog has enough content to require scrolling.
                  Scroll down to see the sticky footer with action buttons.
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowDialog(false)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Drawer */}
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

      {/* Test Drawer with Form */}
      <Drawer open={showDrawerWithForm} onOpenChange={setShowDrawerWithForm}>
        <DrawerContent height="70vh">
          <DrawerHeader>
            <DrawerTitle>Drawer with Form</DrawerTitle>
            <DrawerDescription>
              Test scrollable body with fixed header and footer
            </DrawerDescription>
            <DrawerClose className="absolute right-4 top-1 p-2 rounded-full opacity-70 hover:opacity-100 hover:bg-muted">
              <Icon name="X" size={16} />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </DrawerHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search for something..."
                leftIcon={<Icon name="Search" size={16} />}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL</label>
              <Input
                placeholder="https://example.com"
                leftIcon={<Icon name="Globe" size={16} />}
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
              <Icon name="Check" size={16} className="mr-2" />
              Apply
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Side Drawer - Left */}
      <SideDrawer open={showSideDrawerLeft} onOpenChange={setShowSideDrawerLeft}>
        <SideDrawerContent side="left" size={sideDrawerSize} showOverlay={overlayDark}>
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle>Left Side Drawer</SideDrawerTitle>
            <SideDrawerDescription>
              Slides in from the left. Size: {sideDrawerSize}
            </SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Side drawers are ideal for viewing and editing detail content on desktop.
                They provide more space than dialogs while keeping context visible.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">Sample content area with muted background</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Key Features:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Sticky header with close button</li>
                  <li>Scrollable body content</li>
                  <li>Sticky footer for actions</li>
                  <li>5 size options: sm, md, lg, xl, 2xl</li>
                </ul>
              </div>
            </div>
          </SideDrawerBody>
          <SideDrawerFooter sticky>
            <Button variant="outline" onClick={() => setShowSideDrawerLeft(false)}>
              Close
            </Button>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* Side Drawer - Right */}
      <SideDrawer open={showSideDrawerRight} onOpenChange={setShowSideDrawerRight}>
        <SideDrawerContent side="right" size={sideDrawerSize} showOverlay={overlayDark}>
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle>Right Side Drawer</SideDrawerTitle>
            <SideDrawerDescription>
              Slides in from the right. Size: {sideDrawerSize}
            </SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Right-side drawers are the most common pattern for detail views,
                as they don't conflict with left-side navigation.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">Sample content area with muted background</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Used in WeWrite for:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Admin user detail views</li>
                  <li>Page editing sidebars</li>
                  <li>Settings panels</li>
                  <li>Preview panes</li>
                </ul>
              </div>
            </div>
          </SideDrawerBody>
          <SideDrawerFooter sticky>
            <Button variant="outline" onClick={() => setShowSideDrawerRight(false)}>
              Close
            </Button>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* Side Drawer with Form */}
      <SideDrawer open={showSideDrawerWithForm} onOpenChange={setShowSideDrawerWithForm}>
        <SideDrawerContent side="right" size="lg" showOverlay={overlayDark}>
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle>Edit User Details</SideDrawerTitle>
            <SideDrawerDescription>
              Example form layout with sticky header and footer
            </SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="Enter username..."
                  leftIcon={<Icon name="User" size={16} />}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  placeholder="user@example.com"
                  leftIcon={<Icon name="Mail" size={16} />}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Website</label>
                <Input
                  placeholder="https://example.com"
                  leftIcon={<Icon name="Globe" size={16} />}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Admin Access</label>
                  <p className="text-xs text-muted-foreground">Grant administrator privileges</p>
                </div>
                <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm font-medium mb-2">Account Status</p>
                <div className="flex gap-2">
                  <Badge variant="default-static">Active</Badge>
                  <Badge variant="secondary-static">Verified</Badge>
                </div>
              </div>

              {/* Extra content to test scrolling */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Bio</label>
                <Input placeholder="Tell us about yourself..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input placeholder="City, Country" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Twitter</label>
                <Input placeholder="@username" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LinkedIn</label>
                <Input placeholder="linkedin.com/in/username" />
              </div>
            </div>
          </SideDrawerBody>
          <SideDrawerFooter sticky className="flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSideDrawerWithForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setShowSideDrawerWithForm(false)} className="flex-1">
              <Icon name="Check" size={16} className="mr-2" />
              Save Changes
            </Button>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>

      {/* Navigation Stack Demo */}
      <Drawer
        open={showSettingsDrawer}
        onOpenChange={(open) => {
          setShowSettingsDrawer(open);
          if (!open) {
            // Reset after animation completes
            setTimeout(() => setSettingsActiveSection(null), 300);
          }
        }}
      >
        <DrawerContent height="85vh" showOverlay={true}>
          <AnimatedHeader
            activeSection={settingsActiveSection ? DEMO_SECTIONS.find(s => s.id === settingsActiveSection) || null : null}
            onBack={() => setSettingsActiveSection(null)}
            rootTitle="Settings"
          />

          <DrawerNavigationStack
            activeView={settingsActiveSection}
            className="flex-1"
          >
            <DrawerNavigationStack.Root className="overflow-y-auto">
              <div className="h-full overflow-y-auto divide-y divide-border pb-safe">
                {DEMO_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSettingsActiveSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none"
                  >
                    <div className="flex items-center">
                      <Icon name={section.icon} size={20} className="mr-3 text-foreground" />
                      <span className="font-medium">{section.title}</span>
                    </div>
                    <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </DrawerNavigationStack.Root>

            <DrawerNavigationStack.Detail className="overflow-y-auto pb-safe">
              {settingsActiveSection && (
                <div className="p-4 space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-2">
                      {DEMO_SECTIONS.find(s => s.id === settingsActiveSection)?.title} Section
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This is the detail view for the "{settingsActiveSection}" section.
                      In the real SettingsDrawer, this content is lazy-loaded from separate components.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Demo Input</label>
                    <Input placeholder="Enter something..." />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Demo Toggle</label>
                      <p className="text-xs text-muted-foreground">Toggle something on or off</p>
                    </div>
                    <Switch />
                  </div>

                  <Button className="w-full mt-4" onClick={() => setShowSettingsDrawer(false)}>
                    Save & Close
                  </Button>
                </div>
              )}
            </DrawerNavigationStack.Detail>
          </DrawerNavigationStack>
        </DrawerContent>
      </Drawer>
    </ComponentShowcase>
  );
}
