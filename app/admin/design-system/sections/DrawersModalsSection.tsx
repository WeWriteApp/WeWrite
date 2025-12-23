"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '../../../components/ui/drawer';
import PillLink from '../../../components/utils/PillLink';
import { ComponentShowcase, StateDemo } from './shared';

export function DrawersModalsSection({ id }: { id: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showDrawerWithForm, setShowDrawerWithForm] = useState(false);
  const [overlayDark, setOverlayDark] = useState(true);
  const [overlayBlur, setOverlayBlur] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);

  return (
    <ComponentShowcase
      id={id}
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

      {/* Test Dialog */}
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
    </ComponentShowcase>
  );
}
