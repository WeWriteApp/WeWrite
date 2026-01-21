"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '../../components/ui/drawer';
import { SideDrawer, SideDrawerContent, SideDrawerHeader, SideDrawerBody, SideDrawerFooter, SideDrawerTitle, SideDrawerDescription } from '../../components/ui/side-drawer';
import { AdaptiveModal } from '../../components/ui/adaptive-modal';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock, DocsNote } from './shared';

export function DrawersModalsSection({ id }: { id: string }) {
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [sideDrawerSize, setSideDrawerSize] = useState<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('md');

  return (
    <ComponentShowcase
      id={id}
      title="Drawers & Modals"
      path="app/components/ui/adaptive-modal.tsx"
      description="Use AdaptiveModal for responsive modals that automatically switch between Dialog (desktop) and Drawer (mobile). For specific use cases, individual Dialog, Drawer, and SideDrawer components are also available."
    >
      {/* AdaptiveModal - Primary Recommendation */}
      <StateDemo label="AdaptiveModal (Recommended)">
        <div className="space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-green-500 bg-green-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Smartphone" size={16} className="text-green-500" />
              <Icon name="Monitor" size={16} className="text-green-500" />
              <h4 className="font-semibold text-green-700 dark:text-green-400">Use This for Most Modals</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              <strong>AdaptiveModal</strong> automatically renders as a centered Dialog on desktop and a bottom Drawer on mobile.
              It handles responsive behavior, URL hash tracking, and analytics out of the box.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Desktop (≥768px): Centered dialog with proper animations</li>
              <li>• Mobile (&lt;768px): Bottom drawer with swipe-to-dismiss</li>
              <li>• Supports hashId for deep linking (#modal-name)</li>
              <li>• Supports analyticsId for tracking open/close events</li>
            </ul>
          </div>

          <Button onClick={() => setShowAdaptiveModal(true)}>
            <Icon name="Layers" size={16} className="mr-2" />
            Open AdaptiveModal
          </Button>

          <CollapsibleDocs type="usage">
            <DocsCodeBlock label="Import and Usage">
{`import { AdaptiveModal } from '@/components/ui/adaptive-modal';

<AdaptiveModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  hashId="my-modal"          // Optional: adds #my-modal to URL
  analyticsId="my-modal"     // Optional: tracks open/close
  mobileHeight="85vh"        // Optional: drawer height on mobile
  className="sm:max-w-lg"    // Optional: dialog width on desktop
>
  <div className="space-y-4">
    {/* Your content here */}
  </div>
</AdaptiveModal>`}
            </DocsCodeBlock>
          </CollapsibleDocs>
        </div>
      </StateDemo>

      {/* When to Use What */}
      <StateDemo label="Component Comparison">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="wewrite-card p-4 border-l-4 border-l-green-500">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Layers" size={16} className="text-green-500" />
              AdaptiveModal
            </h4>
            <p className="text-xs text-muted-foreground mb-2">Responsive modal that adapts to screen size.</p>
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Best for: Most use cases</p>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-blue-500">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Square" size={16} className="text-blue-500" />
              Dialog
            </h4>
            <p className="text-xs text-muted-foreground mb-2">Centered modal for focused tasks.</p>
            <p className="text-xs font-medium text-muted-foreground">Best for: Desktop-only confirmations</p>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-purple-500">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="ArrowUp" size={16} className="text-purple-500" />
              Drawer
            </h4>
            <p className="text-xs text-muted-foreground mb-2">Bottom sheet with swipe gesture.</p>
            <p className="text-xs font-medium text-muted-foreground">Best for: Mobile-first navigation</p>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-orange-500">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="PanelRight" size={16} className="text-orange-500" />
              SideDrawer
            </h4>
            <p className="text-xs text-muted-foreground mb-2">Full-height panel from left/right.</p>
            <p className="text-xs font-medium text-muted-foreground">Best for: Detail views, editing forms</p>
          </div>
        </div>
      </StateDemo>

      {/* Individual Components Demo */}
      <StateDemo label="Individual Components">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setShowDialog(true)}>
            Open Dialog
          </Button>
          <Button variant="outline" onClick={() => setShowDrawer(true)}>
            Open Drawer
          </Button>
          <Button variant="outline" onClick={() => setShowSideDrawer(true)}>
            Open SideDrawer
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <span className="text-sm text-muted-foreground">SideDrawer Size:</span>
          <div className="flex flex-wrap gap-2">
            {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
              <Button
                key={size}
                size="sm"
                variant={sideDrawerSize === size ? 'default' : 'ghost'}
                onClick={() => setSideDrawerSize(size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </StateDemo>

      {/* AdaptiveModal */}
      <AdaptiveModal
        isOpen={showAdaptiveModal}
        onClose={() => setShowAdaptiveModal(false)}
        title="AdaptiveModal Demo"
        hashId="adaptive-modal-demo"
        className="sm:max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This modal automatically switches between Dialog (desktop) and Drawer (mobile).
            Try resizing your browser window to see it change!
          </p>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Current View</p>
            <p className="text-sm text-muted-foreground">
              Desktop: Centered dialog with backdrop
              <br />
              Mobile: Bottom drawer with swipe gesture
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sample Input</label>
            <Input placeholder="Type something..." />
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowAdaptiveModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setShowAdaptiveModal(false)} className="flex-1">
              Confirm
            </Button>
          </div>
        </div>
      </AdaptiveModal>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dialog Demo</DialogTitle>
            <DialogDescription>A centered modal for desktop use.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Dialogs are best for quick confirmations and focused tasks on desktop.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowDialog(false)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent height="auto">
          <DrawerHeader className="text-center">
            <DrawerTitle>Drawer Demo</DrawerTitle>
            <DrawerDescription>A bottom sheet for mobile use.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Drawers slide up from the bottom and support swipe-to-dismiss.
            </p>
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

      {/* SideDrawer */}
      <SideDrawer open={showSideDrawer} onOpenChange={setShowSideDrawer}>
        <SideDrawerContent side="right" size={sideDrawerSize}>
          <SideDrawerHeader sticky showClose>
            <SideDrawerTitle>SideDrawer Demo</SideDrawerTitle>
            <SideDrawerDescription>Size: {sideDrawerSize}</SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Side drawers are great for detail views and editing forms on desktop.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input placeholder="Enter username..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input placeholder="user@example.com" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enable notifications</span>
                <Switch />
              </div>
            </div>
          </SideDrawerBody>
          <SideDrawerFooter sticky className="flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSideDrawer(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setShowSideDrawer(false)} className="flex-1">
              Save
            </Button>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>
    </ComponentShowcase>
  );
}
