"use client";

import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/Icon';
import {
  AnimatedStack,
  AnimatedStackItem,
  AnimatedPresenceItem,
  ANIMATION_PRESETS,
  AnimationPreset,
} from '../../components/ui/AnimatedStack';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function AnimationsSection({ id }: { id: string }) {
  // Demo states
  const [stackItems, setStackItems] = useState<string[]>(['Item 1', 'Item 2', 'Item 3']);
  const [showSingleItem, setShowSingleItem] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<AnimationPreset>('default');
  const [showBanner, setShowBanner] = useState(false);

  const addItem = () => {
    setStackItems([...stackItems, `Item ${stackItems.length + 1}`]);
  };

  const removeItem = (index: number) => {
    setStackItems(stackItems.filter((_, i) => i !== index));
  };

  const removeLastItem = () => {
    if (stackItems.length > 0) {
      setStackItems(stackItems.slice(0, -1));
    }
  };

  return (
    <ComponentShowcase
      id={id}
      title="Animations"
      path="app/components/ui/AnimatedStack.tsx"
      description="Standardized animation system for elements entering and exiting the layout. Prevents layout shifts with smooth height transitions."
    >
      {/* Animation Presets */}
      <StateDemo label="Animation Presets">
        <div className="w-full space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ANIMATION_PRESETS) as AnimationPreset[]).map((preset) => (
              <Button
                key={preset}
                variant={selectedPreset === preset ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPreset(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            <pre className="bg-muted/30 p-2 rounded overflow-x-auto">
              {JSON.stringify(ANIMATION_PRESETS[selectedPreset], null, 2)}
            </pre>
          </div>
        </div>
      </StateDemo>

      {/* AnimatedStack Demo */}
      <StateDemo label="AnimatedStack - Multiple Items">
        <div className="w-full max-w-md space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={addItem}>
              <Icon name="Plus" size={16} />
              Add Item
            </Button>
            <Button size="sm" variant="secondary" onClick={removeLastItem}>
              <Icon name="Minus" size={16} />
              Remove Last
            </Button>
          </div>

          <div className="wewrite-card p-4">
            <p className="text-sm text-muted-foreground mb-3">Stack items (gap: 8px, preset: {selectedPreset})</p>
            <AnimatedStack gap={8} preset={selectedPreset}>
              {stackItems.map((item, index) => (
                <AnimatedStackItem key={item}>
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                    >
                      <Icon name="X" size={14} />
                    </Button>
                  </div>
                </AnimatedStackItem>
              ))}
            </AnimatedStack>
            {stackItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items. Click "Add Item" to add some.
              </p>
            )}
          </div>
        </div>
      </StateDemo>

      {/* AnimatedPresenceItem Demo */}
      <StateDemo label="AnimatedPresenceItem - Single Toggle">
        <div className="w-full max-w-md space-y-4">
          <Button
            size="sm"
            variant={showSingleItem ? 'destructive-secondary' : 'default'}
            onClick={() => setShowSingleItem(!showSingleItem)}
          >
            <Icon name={showSingleItem ? 'EyeOff' : 'Eye'} size={16} />
            {showSingleItem ? 'Hide' : 'Show'} Item
          </Button>

          <div className="wewrite-card p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Content before
            </p>
            <AnimatedPresenceItem
              show={showSingleItem}
              gap={8}
              preset={selectedPreset}
              gapPosition="both"
            >
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <Icon name="Sparkles" size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Animated content</p>
                <p className="text-xs text-muted-foreground">This smoothly animates in and out</p>
              </div>
            </AnimatedPresenceItem>
            <p className="text-sm text-muted-foreground">
              Content after
            </p>
          </div>
        </div>
      </StateDemo>

      {/* Banner/Alert Example */}
      <StateDemo label="Real-World Example: Alert Banner">
        <div className="w-full max-w-md space-y-4">
          <Button
            size="sm"
            variant={showBanner ? 'destructive-secondary' : 'destructive'}
            onClick={() => setShowBanner(!showBanner)}
          >
            <Icon name={showBanner ? 'BellOff' : 'Bell'} size={16} />
            {showBanner ? 'Dismiss Alert' : 'Trigger Alert'}
          </Button>

          <div className="space-y-2">
            <AnimatedPresenceItem show={showBanner} gap={8} preset="gentleSpring">
              <div className="flex items-center gap-3 bg-error-10 border border-error/20 text-error rounded-xl px-4 py-3">
                <Icon name="AlertTriangle" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Connection lost</p>
                  <p className="text-xs opacity-80">Attempting to reconnect...</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-error hover:text-error hover:bg-error/10"
                  onClick={() => setShowBanner(false)}
                >
                  <Icon name="X" size={16} />
                </Button>
              </div>
            </AnimatedPresenceItem>
            <div className="wewrite-card p-4">
              <p className="text-sm text-muted-foreground">
                Main content that stays in place while the banner animates above
              </p>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Code Examples */}
      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="AnimatedStack (multiple items)">
{`import { AnimatedStack, AnimatedStackItem } from '@/components/ui/AnimatedStack';

<AnimatedStack gap={12} preset="default">
  {items.map(item => (
    <AnimatedStackItem key={item.id}>
      <Card>{item.content}</Card>
    </AnimatedStackItem>
  ))}
</AnimatedStack>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="AnimatedPresenceItem (single toggle)">
{`import { AnimatedPresenceItem } from '@/components/ui/AnimatedStack';

<AnimatedPresenceItem
  show={showError}
  gap={12}
  preset="gentleSpring"
  gapPosition="top"
>
  <ErrorBanner message="Something went wrong" />
</AnimatedPresenceItem>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="Direct Framer Motion usage">
{`import { AnimatePresence, motion } from 'framer-motion';

<AnimatePresence>
  {show && (
    <motion.div
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <Button>Animated Button</Button>
    </motion.div>
  )}
</AnimatePresence>`}
        </DocsCodeBlock>
      </CollapsibleDocs>

      {/* Available Presets Reference */}
      <CollapsibleDocs type="api" title="Available Presets">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.entries(ANIMATION_PRESETS) as [AnimationPreset, typeof ANIMATION_PRESETS[AnimationPreset]][]).map(
            ([name, config]) => (
              <div key={name} className="wewrite-card p-3">
                <p className="text-sm font-medium mb-1">{name}</p>
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            )
          )}
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
