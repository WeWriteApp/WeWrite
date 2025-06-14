"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Users, FileText, Heart, Lock } from 'lucide-react';
import FollowingList from './FollowingList';
import FollowedPages from '../pages/FollowedPages';

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
  // Privacy restriction: Only allow the current user to see their following list
  if (!isCurrentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-2">Private Information</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Following relationships are private and can only be viewed by the account owner.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header explaining this tab shows both followed users and pages */}
      <div className="bg-muted/50 p-4 rounded-lg mb-4">
        <h3 className="text-sm font-medium mb-1 flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-primary" />
          Following
        </h3>
        <p className="text-sm text-muted-foreground">
          View both users and pages that you're following
        </p>
      </div>

      <Tabs defaultValue="users" urlNavigation="hash" className="w-full">
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
