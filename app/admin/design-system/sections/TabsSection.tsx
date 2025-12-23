"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { ComponentShowcase, StateDemo } from './shared';

export function TabsSection({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <ComponentShowcase
      id={id}
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
                <Icon name="User" size={16} />
                Users
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Icon name="Settings" size={16} />
                Settings
              </TabsTrigger>
              <TabsTrigger value="mail" className="flex items-center gap-2">
                <Icon name="Mail" size={16} />
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
  );
}
