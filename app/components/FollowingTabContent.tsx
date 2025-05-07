"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Users, FileText } from 'lucide-react';
import FollowingList from './FollowingList';
import FollowedPages from './FollowedPages';

interface FollowingTabContentProps {
  userId: string;
  isCurrentUser: boolean;
}

/**
 * FollowingTabContent Component
 * 
 * Displays both followed users and followed pages in a tabbed interface
 */
export default function FollowingTabContent({ userId, isCurrentUser }: FollowingTabContentProps) {
  const [activeTab, setActiveTab] = useState<string>('users');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Pages</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-0">
          <FollowingList userId={userId} isCurrentUser={isCurrentUser} />
        </TabsContent>
        
        <TabsContent value="pages" className="mt-0">
          <FollowedPages 
            userId={userId} 
            isCurrentUser={isCurrentUser} 
            showHeader={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
