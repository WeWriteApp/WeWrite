"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../../../components/ui/side-drawer';

interface EmailPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  templateName: string | null;
  html: string | null;
  loading: boolean;
  isPersonalized: boolean;
  error: string | null;
  triggerReason: string | null;
  userId: string | null;
  username: string | null;
  isDarkMode: boolean;
  cronActionLoading: boolean;
  showScheduleInput: boolean;
  setShowScheduleInput: (show: boolean) => void;
  scheduleInputValue: string;
  setScheduleInputValue: (val: string) => void;
  onTriggerCronForUser: (templateId: string, userId: string, scheduledAt?: string) => void;
  onViewFullDetails: () => void;
  transformEmailForDarkMode: (html: string) => string;
  toast: any;
}

export function EmailPreviewDrawer({
  open,
  onOpenChange,
  templateId,
  templateName,
  html,
  loading,
  isPersonalized,
  error,
  triggerReason,
  userId,
  username,
  isDarkMode,
  cronActionLoading,
  showScheduleInput,
  setShowScheduleInput,
  scheduleInputValue,
  setScheduleInputValue,
  onTriggerCronForUser,
  onViewFullDetails,
  transformEmailForDarkMode,
  toast,
}: EmailPreviewDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      hashId="email-preview"
    >
      <SideDrawerContent side="right" size="xl">
        <SideDrawerHeader sticky showClose>
          <SideDrawerTitle className="flex items-center gap-2">
            <Icon name="Mail" size={20} />
            Email Preview
            {isPersonalized && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                Personalized
              </span>
            )}
          </SideDrawerTitle>
          <SideDrawerDescription>
            {templateName || templateId}
            {isPersonalized && username && (
              <span className="text-xs ml-2">
                for <span className="font-medium">@{username}</span>
              </span>
            )}
          </SideDrawerDescription>
        </SideDrawerHeader>

        <SideDrawerBody>
          {/* Trigger Reason Box */}
          {triggerReason && (
            <div className="mb-4 p-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Icon name="Lightbulb" size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
                    Why this notification is triggered
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                    {triggerReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Icon name="Loader" className="text-primary" />
            </div>
          ) : html ? (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <div className={`rounded-lg shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <iframe
                  srcDoc={isDarkMode
                    ? transformEmailForDarkMode(html)
                    : html
                  }
                  className="w-full h-[600px] border-0"
                  title="Email Preview"
                />
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <Icon name="AlertCircle" size={20} />
                <span className="font-medium">Failed to load email preview</span>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-destructive">Error Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={async () => {
                      await navigator.clipboard.writeText(error);
                      toast({
                        title: 'Copied!',
                        description: 'Error details copied to clipboard',
                      });
                    }}
                  >
                    <Icon name="Copy" size={12} className="mr-1" />
                    Copy Error
                  </Button>
                </div>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap bg-muted/50 p-3 rounded">
                  {error}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="Mail" size={48} className="mx-auto mb-3 opacity-50" />
              <p>No preview available</p>
            </div>
          )}
        </SideDrawerBody>

        <SideDrawerFooter sticky>
          <div className="flex flex-col gap-3 w-full">
            {/* Send Now / Schedule buttons - only show if we have a specific user */}
            {userId && templateId && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="default"
                  size="sm"
                  disabled={cronActionLoading}
                  onClick={() => {
                    onTriggerCronForUser(templateId, userId);
                  }}
                  className="gap-1 flex-1"
                >
                  {cronActionLoading ? (
                    <Icon name="Loader" size={14} />
                  ) : (
                    <Icon name="Send" size={14} />
                  )}
                  Send Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cronActionLoading}
                  onClick={() => setShowScheduleInput(!showScheduleInput)}
                  className="gap-1"
                >
                  <Icon name="Clock" size={14} />
                  Schedule
                </Button>
              </div>
            )}

            {/* Schedule input */}
            {showScheduleInput && userId && templateId && (
              <div className="flex gap-2 items-start w-full">
                <div className="flex-1">
                  <Input
                    placeholder="e.g., 'in 20 minutes' or ISO date"
                    value={scheduleInputValue}
                    onChange={(e) => setScheduleInputValue(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  disabled={cronActionLoading || !scheduleInputValue.trim()}
                  onClick={() => onTriggerCronForUser(templateId, userId, scheduleInputValue)}
                  className="gap-1"
                >
                  {cronActionLoading ? (
                    <Icon name="Loader" size={14} />
                  ) : (
                    <Icon name="Send" size={14} />
                  )}
                  Schedule
                </Button>
              </div>
            )}

            {/* Bottom row with template ID and view details */}
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-muted-foreground">
                Template ID: <code className="bg-muted px-1 rounded">{templateId}</code>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onViewFullDetails}
              >
                <Icon name="ExternalLink" size={16} className="mr-2" />
                View Full Details
              </Button>
            </div>
          </div>
        </SideDrawerFooter>
      </SideDrawerContent>
    </SideDrawer>
  );
}
