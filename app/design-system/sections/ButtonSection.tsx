"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { ComponentShowcase, StateDemo } from './shared';

export function ButtonSection({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <ComponentShowcase
      id={id}
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

      <StateDemo label="Icon Sizes (Button)">
        <Button size="icon-sm"><Icon name="Settings" size={16} /></Button>
        <Button size="icon"><Icon name="Settings" size={20} /></Button>
        <Button size="icon-lg"><Icon name="Settings" size={24} /></Button>
      </StateDemo>

      <StateDemo label="IconButton Wrapper">
        <IconButton variant="default"><Icon name="Settings" size={20} /></IconButton>
        <IconButton variant="secondary"><Icon name="Search" size={20} /></IconButton>
        <IconButton variant="outline"><Icon name="User" size={20} /></IconButton>
        <IconButton variant="ghost"><Icon name="Heart" size={20} /></IconButton>
        <IconButton variant="destructive"><Icon name="X" size={20} /></IconButton>
        <IconButton variant="success"><Icon name="Check" size={20} /></IconButton>
        <div className="text-xs text-muted-foreground ml-2 self-center">
          <code className="bg-muted px-1 rounded">IconButton</code> = Button with <code className="bg-muted px-1 rounded">size="icon"</code> default
        </div>
      </StateDemo>

      <StateDemo label="States">
        <Button>Normal</Button>
        <Button disabled>Disabled</Button>
        <Button onClick={handleLoadingDemo} disabled={loading}>
          {loading && <Icon name="Loader" />}
          {loading ? 'Loading...' : 'Click for Loading'}
        </Button>
      </StateDemo>

      <StateDemo label="With Icons">
        <Button><Icon name="Plus" size={16} className="mr-2" />Add Item</Button>
        <Button variant="secondary"><Icon name="Search" size={16} className="mr-2" />Search</Button>
        <Button variant="success"><Icon name="Check" size={16} className="mr-2" />Save</Button>
        <Button variant="destructive"><Icon name="X" size={16} className="mr-2" />Delete</Button>
        <Button variant="success-secondary"><Icon name="Check" size={16} className="mr-2" />Approve</Button>
        <Button variant="destructive-ghost"><Icon name="X" size={16} className="mr-2" />Remove</Button>
      </StateDemo>
    </ComponentShowcase>
  );
}
