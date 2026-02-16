'use client';

import React from 'react';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../../../components/ui/side-drawer';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface CreateNotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createNotifUsername: string;
  setCreateNotifUsername: (v: string) => void;
  createNotifTemplateId: string;
  setCreateNotifTemplateId: (v: string) => void;
  createNotifScheduledAt: string;
  setCreateNotifScheduledAt: (v: string) => void;
  createNotifLoading: boolean;
  selectedUserId: string | null;
  setSelectedUserId: (v: string | null) => void;
  userSearchResults: Array<{ uid: string; username: string; email: string }>;
  setUserSearchResults: (v: Array<{ uid: string; username: string; email: string }>) => void;
  userSearchLoading: boolean;
  onSearchUsers: (query: string) => void;
  onCreateNotification: () => void;
}

export function CreateNotificationDrawer({
  open,
  onOpenChange,
  createNotifUsername,
  setCreateNotifUsername,
  createNotifTemplateId,
  setCreateNotifTemplateId,
  createNotifScheduledAt,
  setCreateNotifScheduledAt,
  createNotifLoading,
  selectedUserId,
  setSelectedUserId,
  userSearchResults,
  setUserSearchResults,
  userSearchLoading,
  onSearchUsers,
  onCreateNotification,
}: CreateNotificationDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setCreateNotifUsername('');
          setCreateNotifTemplateId('');
          setCreateNotifScheduledAt('');
          setSelectedUserId(null);
          setUserSearchResults([]);
        }
      }}
      hashId="create-notification"
    >
      <SideDrawerContent side="right" size="md">
        <SideDrawerHeader sticky showClose>
          <SideDrawerTitle className="flex items-center gap-2">
            <Icon name="Plus" size={20} />
            New Notification
          </SideDrawerTitle>
          <SideDrawerDescription>
            Send a notification to a specific user
          </SideDrawerDescription>
        </SideDrawerHeader>

        <SideDrawerBody>
          <div className="space-y-4">
            {/* User Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Recipient</label>
              {selectedUserId ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Icon name="User" size={16} className="text-muted-foreground" />
                  <span className="font-medium">@{createNotifUsername}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7"
                    onClick={() => {
                      setSelectedUserId(null);
                      setCreateNotifUsername('');
                      setUserSearchResults([]);
                    }}
                  >
                    <Icon name="X" size={14} />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Search by username or email..."
                    value={createNotifUsername}
                    onChange={(e) => {
                      setCreateNotifUsername(e.target.value);
                      onSearchUsers(e.target.value);
                    }}
                    leftIcon={userSearchLoading ? <Icon name="Loader" size={16} /> : <Icon name="Search" size={16} />}
                  />
                  {userSearchResults.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.uid}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2 text-sm"
                          onClick={() => {
                            setSelectedUserId(user.uid);
                            setCreateNotifUsername(user.username || user.email);
                            setUserSearchResults([]);
                          }}
                        >
                          <Icon name="User" size={14} className="text-muted-foreground" />
                          <span className="font-medium">{user.username ? `@${user.username}` : user.email}</span>
                          {user.username && (
                            <span className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Notification Type</label>
              <select
                value={createNotifTemplateId}
                onChange={(e) => setCreateNotifTemplateId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select notification type...</option>
                <optgroup label="Email Verification">
                  <option value="verification-reminder">Email Verification Reminder</option>
                </optgroup>
                <optgroup label="Engagement">
                  <option value="choose-username">Choose Username Reminder</option>
                  <option value="first-page-activation">First Page Activation</option>
                  <option value="weekly-digest">Weekly Digest</option>
                  <option value="reactivation">Re-activation</option>
                </optgroup>
                <optgroup label="Payments">
                  <option value="payout-setup-reminder">Payout Setup Reminder</option>
                </optgroup>
              </select>
            </div>

            {/* Schedule (optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Schedule (optional)
              </label>
              <Input
                placeholder="e.g., 'in 20 minutes', 'tomorrow at 3pm', or leave blank to send now"
                value={createNotifScheduledAt}
                onChange={(e) => setCreateNotifScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to send immediately
              </p>
            </div>
          </div>
        </SideDrawerBody>

        <SideDrawerFooter sticky>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="flex-1 gap-1"
              disabled={createNotifLoading || !selectedUserId || !createNotifTemplateId}
              onClick={onCreateNotification}
            >
              {createNotifLoading ? (
                <Icon name="Loader" size={16} />
              ) : (
                <Icon name="Send" size={16} />
              )}
              {createNotifScheduledAt ? 'Schedule' : 'Send Now'}
            </Button>
          </div>
        </SideDrawerFooter>
      </SideDrawerContent>
    </SideDrawer>
  );
}
