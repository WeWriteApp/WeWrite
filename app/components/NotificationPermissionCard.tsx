"use client";

import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronDown, ChevronUp, X, AlertTriangle, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useNotificationPermission } from '../providers/NotificationPermissionProvider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { checkNotificationSupport, getBrowserInfo } from '../utils/browser-compatibility';

export default function NotificationPermissionCard() {
  const { permission, isSupported, requestPermission, showNotification } = useNotificationPermission();
  const [isOpen, setIsOpen] = useState(false);

  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [compatibilityDetails, setCompatibilityDetails] = useState<{
    browser: { name: string; version: string };
    details: {
      notificationApiSupported: boolean;
      serviceWorkerSupported: boolean;
      secureContext: boolean;
    };
  } | null>(null);

  // Get browser compatibility details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { details } = checkNotificationSupport();
      const browserInfo = getBrowserInfo();

      setCompatibilityDetails({
        browser: browserInfo,
        details
      });
    }
  }, []);

  const handleRequestPermission = async () => {
    try {
      setIsRequesting(true);
      setRequestError(null);

      console.log('Requesting notification permission from UI...');
      const result = await requestPermission();
      console.log(`Permission request result from UI: ${result}`);

      // Show a test notification if permission was granted
      if (result === 'granted') {
        console.log('Permission granted, showing test notification...');
        setTimeout(async () => {
          try {
            const notificationShown = await showNotification('Notifications enabled!', {
              body: 'You will now receive notifications when something happens on WeWrite.',
            });
            console.log('Test notification result:', notificationShown ? 'shown' : 'failed');
          } catch (notifyError) {
            console.error('Error showing test notification:', notifyError);
            setRequestError('Permission was granted but there was an error showing the test notification.');
          }
        }, 500);
      } else if (result === 'denied') {
        setRequestError('Notification permission was denied. Please check your browser settings.');
      } else {
        setRequestError('Notification permission request did not complete. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleRequestPermission:', error);
      setRequestError('There was an error requesting notification permission. Please try again or check your browser settings.');
    } finally {
      setIsRequesting(false);
    }
  };

  // If we have compatibility details but notifications aren't fully supported,
  // show a card with compatibility information instead
  if (compatibilityDetails && !isSupported) {
    const { browser, details } = compatibilityDetails;
    const { notificationApiSupported, serviceWorkerSupported, secureContext } = details;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Notifications Not Available</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-1.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <Info className="h-4 w-4" />
              <span>Your browser doesn't fully support notifications</span>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Your browser ({browser.name} {browser.version}) doesn't fully support the features needed for notifications:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    {!notificationApiSupported && (
                      <li className="text-red-600 dark:text-red-400">Notification API not supported</li>
                    )}
                    {!serviceWorkerSupported && (
                      <li className="text-red-600 dark:text-red-400">Service Worker API not supported</li>
                    )}
                    {!secureContext && (
                      <li className="text-red-600 dark:text-red-400">Not running in a secure context (HTTPS required)</li>
                    )}
                  </ul>

                  <p className="mt-4">To receive notifications, try:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Using a modern browser like Chrome, Firefox, or Edge</li>
                    <li>Making sure you're accessing the site via HTTPS</li>
                    <li>Updating your browser to the latest version</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // If notifications are not supported and we don't have compatibility details, don't show the card
  if (!isSupported) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 text-sm">
          {permission === 'granted' ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Notifications enabled</span>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              <span>Notifications blocked</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Notifications not enabled</span>
          )}
        </div>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {permission === 'granted' ? (
              <div className="text-sm text-muted-foreground">
                <p>You'll receive notifications when:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Someone follows your pages</li>
                  <li>Someone links to your pages</li>
                  <li>Someone adds your pages to their own</li>
                </ul>
              </div>
            ) : permission === 'denied' ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>You've blocked notifications for WeWrite. To enable them:</p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Click the lock/info icon in your browser's address bar</li>
                    <li>Find "Notifications" in the site settings</li>
                    <li>Change the setting from "Block" to "Allow"</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Don't want to miss out? Enable notifications to stay updated when:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Someone follows your pages</li>
                    <li>Someone links to your pages</li>
                    <li>Someone adds your pages to their own</li>
                  </ul>
                </div>

                {requestError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                    {requestError}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 text-foreground"
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      <span>Enable Notifications</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
