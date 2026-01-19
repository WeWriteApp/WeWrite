"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
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
      <StateDemo label="Basic Tabs (10 items)">
        <div className="w-full overflow-x-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="tab1">Overview</TabsTrigger>
              <TabsTrigger value="tab2">Analytics</TabsTrigger>
              <TabsTrigger value="tab3">Settings</TabsTrigger>
              <TabsTrigger value="tab4">Reports</TabsTrigger>
              <TabsTrigger value="tab5">Notifications</TabsTrigger>
              <TabsTrigger value="tab6">Billing</TabsTrigger>
              <TabsTrigger value="tab7">Security</TabsTrigger>
              <TabsTrigger value="tab8">API</TabsTrigger>
              <TabsTrigger value="tab9">Integrations</TabsTrigger>
              <TabsTrigger value="tab10">Help</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Overview content goes here. This is the first tab.</p>
            </TabsContent>
            <TabsContent value="tab2" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Analytics content goes here. This is the second tab.</p>
            </TabsContent>
            <TabsContent value="tab3" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Settings content goes here. This is the third tab.</p>
            </TabsContent>
            <TabsContent value="tab4" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Reports content goes here.</p>
            </TabsContent>
            <TabsContent value="tab5" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Notifications content goes here.</p>
            </TabsContent>
            <TabsContent value="tab6" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Billing content goes here.</p>
            </TabsContent>
            <TabsContent value="tab7" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Security content goes here.</p>
            </TabsContent>
            <TabsContent value="tab8" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">API content goes here.</p>
            </TabsContent>
            <TabsContent value="tab9" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Integrations content goes here.</p>
            </TabsContent>
            <TabsContent value="tab10" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Help content goes here.</p>
            </TabsContent>
          </Tabs>
        </div>
      </StateDemo>

      <StateDemo label="Tabs with Icons (10 items)">
        <div className="w-full overflow-x-auto">
          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users" className="gap-2">
                <Icon name="User" size={16} />
                Users
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Icon name="Settings" size={16} />
                Settings
              </TabsTrigger>
              <TabsTrigger value="mail" className="gap-2">
                <Icon name="Mail" size={16} />
                Mail
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <Icon name="Calendar" size={16} />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <Icon name="Folder" size={16} />
                Files
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <Icon name="BarChart3" size={16} />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="bell" className="gap-2">
                <Icon name="Bell" size={16} />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="shield" className="gap-2">
                <Icon name="Shield" size={16} />
                Security
              </TabsTrigger>
              <TabsTrigger value="globe" className="gap-2">
                <Icon name="Globe" size={16} />
                Network
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-2">
                <Icon name="HelpCircle" size={16} />
                Help
              </TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Manage users and permissions.</p>
            </TabsContent>
            <TabsContent value="settings" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Configure application settings.</p>
            </TabsContent>
            <TabsContent value="mail" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">View and manage email notifications.</p>
            </TabsContent>
            <TabsContent value="calendar" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Calendar and scheduling.</p>
            </TabsContent>
            <TabsContent value="files" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">File management.</p>
            </TabsContent>
            <TabsContent value="analytics" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Analytics and reports.</p>
            </TabsContent>
            <TabsContent value="bell" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Alert settings.</p>
            </TabsContent>
            <TabsContent value="shield" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Security settings.</p>
            </TabsContent>
            <TabsContent value="globe" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Network configuration.</p>
            </TabsContent>
            <TabsContent value="help" className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Help and documentation.</p>
            </TabsContent>
          </Tabs>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
