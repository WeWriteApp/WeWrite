"use client";

import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Download, Smartphone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { usePWA } from '../../providers/PWAProvider';
import { getPWAInstallInstructions } from '../../utils/pwa-detection';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

export default function PWAInstallationCard() {
  const { isPWA } = usePWA();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">PWA Installation</CardTitle>
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
        <CardDescription>
          {isPWA ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Installed as app</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Not installed, you're using the browser</span>
          )}
        </CardDescription>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isPWA ? (
              <div className="text-sm text-muted-foreground">
                <p>You're currently using WeWrite as an installed app. This provides the best experience with faster loading times and offline access.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Installing WeWrite as an app gives you a better experience with:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Faster loading times</li>
                    <li>Offline access to your content</li>
                    <li>App-like experience without the browser interface</li>
                  </ul>
                </div>

                <div className="p-3 bg-muted/50 rounded-md text-sm">
                  <p className="font-medium mb-1">Installation instructions:</p>
                  <p>{getPWAInstallInstructions()}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 text-foreground"
                  onClick={() => {
                    // This is just for UI purposes - the actual installation
                    // is handled by the browser's built-in PWA installation prompt
                    alert("Follow the instructions above to install WeWrite as an app.");
                  }}
                >
                  <Download className="h-4 w-4" />
                  <span>Install WeWrite</span>
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
