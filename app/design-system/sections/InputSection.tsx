"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Input } from '../../components/ui/input';
import { ComponentShowcase, StateDemo } from './shared';

export function InputSection({ id }: { id: string }) {
  const [inputValue, setInputValue] = useState('');

  return (
    <ComponentShowcase
      id={id}
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
        <Input placeholder="Error state" error errorText="This field is required" className="w-64" />
        <Input placeholder="Warning state" warning warningText="This might cause issues" className="w-64" />
      </StateDemo>

      <StateDemo label="With Left Icon">
        <Input
          placeholder="Search..."
          leftIcon={<Icon name="Search" size={16} />}
          className="w-64"
        />
        <Input
          placeholder="Email address"
          leftIcon={<Icon name="Mail" size={16} />}
          className="w-64"
        />
        <Input
          placeholder="Custom title"
          leftIcon={<Icon name="Type" size={16} />}
          className="w-64"
        />
      </StateDemo>

      <StateDemo label="With Right Icon">
        <Input
          placeholder="Website URL"
          rightIcon={<Icon name="Globe" size={16} />}
          className="w-64"
        />
        <Input
          placeholder="Username"
          rightIcon={<Icon name="AtSign" size={16} />}
          className="w-64"
        />
      </StateDemo>

      <StateDemo label="With Both Icons">
        <Input
          placeholder="Search users..."
          leftIcon={<Icon name="Search" size={16} />}
          rightIcon={<Icon name="Check" size={16} className="text-green-500" />}
          className="w-64"
        />
      </StateDemo>
    </ComponentShowcase>
  );
}
