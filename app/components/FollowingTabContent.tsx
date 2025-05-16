"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Users, FileText, Heart } from 'lucide-react';
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
      {/* Header explaining this tab shows both followed users and pages */}
      <div className="bg-muted/50 p-4 rounded-lg mb-4">
        <h3 className="text-sm font-medium mb-1 flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-primary" />
          Following
        </h3>
        <p className="text-sm text-muted-foreground">
          View both users and pages that {isCurrentUser ? "you're" : "this user is"} following
        </p>
      </div>

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
