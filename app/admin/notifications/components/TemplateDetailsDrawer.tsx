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
import { Badge } from '../../../components/ui/badge';
import { NotificationPreview } from './NotificationPreview';
import { PushNotificationPreview } from './PushNotificationPreview';
import type { EmailLogEntry } from '../types';
import type { NotificationFlowItem } from '../config/notificationFlow';

interface TemplateDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  html: string | null;
  loading: boolean;
  logs: EmailLogEntry[];
  showCode: boolean;
  setShowCode: (v: boolean) => void;
  logsOpen: boolean;
  setLogsOpen: (v: boolean) => void;
  isDarkMode: boolean;
  transformEmailForDarkMode: (html: string) => string;
  onUserDetails: (userId?: string, username?: string) => void;
  toast: any;
  // Config access functions
  getFlowItem: (id: string) => NotificationFlowItem | undefined;
  triggerStatus: Record<string, any>;
  notificationModes: Record<string, any>;
  stageConfig: Record<string, any>;
  formatRelativeTime: (date: string | Date) => string;
}

export function TemplateDetailsDrawer({
  open,
  onOpenChange,
  templateId,
  html,
  loading,
  logs,
  showCode,
  setShowCode,
  logsOpen,
  setLogsOpen,
  isDarkMode,
  transformEmailForDarkMode,
  onUserDetails,
  toast,
  getFlowItem,
  triggerStatus,
  notificationModes,
  stageConfig,
  formatRelativeTime,
}: TemplateDetailsDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      hashId="template-details"
    >
      <SideDrawerContent side="right" size="xl">
        <SideDrawerHeader sticky showClose>
          <SideDrawerTitle className="flex items-center gap-2">
            <Icon name="Mail" size={20} />
            {templateId && getFlowItem(templateId)?.name || 'Template Details'}
          </SideDrawerTitle>
          <SideDrawerDescription>
            {templateId && getFlowItem(templateId)?.description}
          </SideDrawerDescription>
        </SideDrawerHeader>

        <SideDrawerBody>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Icon name="Loader" className="text-primary" />
            </div>
          ) : templateId ? (
            <div className="space-y-6">
              {/* Template Info */}
              {(() => {
                const flowItem = getFlowItem(templateId);
                const status = triggerStatus[templateId];
                const modes = notificationModes[templateId] || { email: false, inApp: false, push: false };
                const config = flowItem ? stageConfig[flowItem.stage] : null;

                return (
                  <>
                    {/* Stage & Delivery Info */}
                    <div className="flex flex-wrap items-center gap-2">
                      {config && (
                        <Badge variant="outline" className={`${config.color} border-current`}>
                          <Icon name={config.icon as any} size={12} className="mr-1" />
                          {config.label}
                        </Badge>
                      )}
                      {modes.email && (
                        <Badge variant="secondary" className="gap-1">
                          <Icon name="Mail" size={12} className="text-blue-500" />
                          Email
                        </Badge>
                      )}
                      {modes.inApp && (
                        <Badge variant="secondary" className="gap-1">
                          <Icon name="Bell" size={12} className="text-orange-500" />
                          In-App
                        </Badge>
                      )}
                      {modes.push && (
                        <Badge variant="secondary" className="gap-1">
                          <Icon name="Smartphone" size={12} className="text-purple-500" />
                          Push
                        </Badge>
                      )}
                      {flowItem?.isAutomated && (
                        <Badge variant="secondary" className="gap-1">
                          <Icon name="Clock" size={12} className="text-blue-500" />
                          Automated
                        </Badge>
                      )}
                    </div>

                    {/* Trigger Status */}
                    {status && (
                      <div className={`p-3 rounded-lg border ${
                        status.status === 'active'
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : status.status === 'partial'
                          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          {status.status === 'active' && (
                            <Icon name="CheckCircle2" size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          )}
                          {status.status === 'partial' && (
                            <Icon name="AlertCircle" size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          )}
                          {(status.status === 'not-implemented' || status.status === 'disabled') && (
                            <Icon name="XCircle" size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={`font-medium text-sm ${
                              status.status === 'active'
                                ? 'text-green-800 dark:text-green-200'
                                : status.status === 'partial'
                                ? 'text-yellow-800 dark:text-yellow-200'
                                : 'text-red-800 dark:text-red-200'
                            }`}>
                              {status.status === 'active' && 'Trigger Active'}
                              {status.status === 'partial' && 'Partially Implemented'}
                              {status.status === 'not-implemented' && 'Not Yet Implemented'}
                              {status.status === 'disabled' && 'Disabled'}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              status.status === 'active'
                                ? 'text-green-700 dark:text-green-300'
                                : status.status === 'partial'
                                ? 'text-yellow-700 dark:text-yellow-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                              {status.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Icon name="Mail" size={18} className="text-muted-foreground" />
                          Email Preview
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCode(!showCode)}
                            className="gap-1 h-7"
                          >
                            <Icon name="Code" size={14} />
                            {showCode ? 'Preview' : 'HTML'}
                          </Button>
                          {showCode && html && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await navigator.clipboard.writeText(html);
                                toast({
                                  title: 'Copied!',
                                  description: 'HTML copied to clipboard',
                                });
                              }}
                              className="gap-1 h-7"
                            >
                              <Icon name="Copy" size={14} />
                              Copy
                            </Button>
                          )}
                        </div>
                      </div>
                      {showCode ? (
                        <pre className="p-4 overflow-auto max-h-[400px] text-xs bg-muted/30 rounded-lg border">
                          <code>{html}</code>
                        </pre>
                      ) : (
                        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                          <div className={`rounded-lg shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <iframe
                              srcDoc={isDarkMode && html
                                ? transformEmailForDarkMode(html)
                                : (html || '')
                              }
                              className="w-full h-[400px] border-0"
                              title="Email Preview"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* In-App Notification Preview */}
                    {!showCode && (
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <Icon name="Bell" size={18} className="text-muted-foreground" />
                          In-App Notification Preview
                        </h3>
                        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                          <NotificationPreview templateId={templateId} />
                        </div>
                      </div>
                    )}

                    {/* Push Notification Preview */}
                    {!showCode && (
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <Icon name="Smartphone" size={18} className="text-muted-foreground" />
                          Push Notification Preview
                        </h3>
                        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                          <PushNotificationPreview templateId={templateId} />
                        </div>
                      </div>
                    )}

                    {/* Send History */}
                    <div>
                      <button
                        onClick={() => setLogsOpen(!logsOpen)}
                        className="w-full flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="History" size={18} className="text-muted-foreground" />
                          <h3 className="font-semibold">Send History</h3>
                          <Badge variant="secondary">
                            {logs.length}
                          </Badge>
                        </div>
                        {logsOpen ? (
                          <Icon name="ChevronUp" size={18} className="text-muted-foreground" />
                        ) : (
                          <Icon name="ChevronDown" size={18} className="text-muted-foreground" />
                        )}
                      </button>

                      {logsOpen && (
                        <div className="mt-2">
                          {logs.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
                              <Icon name="Clock" size={32} className="mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No emails sent with this template yet</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {logs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {log.status === 'sent' || log.status === 'delivered' ? (
                                      <Icon name="CheckCircle2" size={16} className="text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Icon name="XCircle" size={16} className="text-red-500 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      {log.recipientUsername ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUserDetails(log.recipientUserId, log.recipientUsername);
                                          }}
                                          className="font-medium text-sm text-primary hover:underline truncate cursor-pointer"
                                        >
                                          @{log.recipientUsername}
                                        </button>
                                      ) : (
                                        <span className="font-medium text-sm truncate">
                                          {log.recipientEmail}
                                        </span>
                                      )}
                                      {log.recipientUsername && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {log.recipientEmail}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <Badge
                                      variant={log.status === 'sent' || log.status === 'delivered' ? 'default' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {log.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatRelativeTime(log.sentAt)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Template Location */}
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Icon name="FileCode" size={16} className="text-muted-foreground" />
                        Template Location
                      </h3>
                      <code className="text-sm bg-muted px-3 py-2 rounded block">
                        app/lib/emailTemplates.ts
                      </code>
                      <p className="text-xs text-muted-foreground mt-2">
                        Look for <code className="bg-muted px-1 rounded">{templateId}EmailTemplate</code>
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </SideDrawerBody>

        <SideDrawerFooter sticky>
          <p className="text-xs text-muted-foreground">
            Template ID: <code className="bg-muted px-1 rounded">{templateId}</code>
          </p>
        </SideDrawerFooter>
      </SideDrawerContent>
    </SideDrawer>
  );
}
