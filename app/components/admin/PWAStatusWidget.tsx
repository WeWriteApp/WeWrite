'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { getPWADataForAdmin } from '../../utils/pwaAnalytics';

interface PWAStatusWidgetProps {
  className?: string;
}

export function PWAStatusWidget({ className = "" }: PWAStatusWidgetProps) {
  const [pwaData, setPwaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get PWA data on client side only
    if (typeof window !== 'undefined') {
      const data = getPWADataForAdmin();
      setPwaData(data);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <Icon name="Smartphone" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">PWA Status</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!pwaData) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <Icon name="Smartphone" size={20} className="text-muted-foreground" />
          <h3 className="text-lg font-semibold text-muted-foreground">PWA Status</h3>
        </div>
        <p className="text-sm text-muted-foreground">PWA data not available</p>
      </div>
    );
  }

  const getDeviceIconName = () => {
    if (pwaData.deviceInfo.isDesktop) return "Monitor";
    if (pwaData.deviceInfo.isIOS || pwaData.deviceInfo.isAndroid) return "Smartphone";
    return "Tablet";
  };

  const deviceIconName = getDeviceIconName();

  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon name={deviceIconName} size={20} className="text-primary" />
        <h3 className="text-lg font-semibold">PWA Status</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          pwaData.isPWA 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {pwaData.isPWA ? 'PWA Mode' : 'Browser Mode'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Display Mode:</span>
            <div className="font-medium capitalize">{pwaData.displayMode}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Platform:</span>
            <div className="font-medium">{pwaData.platform}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Screen Size:</span>
            <div className="font-medium">
              {pwaData.screenSize.width} × {pwaData.screenSize.height}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Orientation:</span>
            <div className="font-medium capitalize">
              {pwaData.orientation.replace('-', ' ')}
            </div>
          </div>
        </div>

        {pwaData.deviceInfo && (
          <div className="pt-2 border-t">
            <span className="text-muted-foreground text-sm">Device Info:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {pwaData.deviceInfo.isIOS && (
                <span className="px-2 py-1 bg-muted text-foreground dark:bg-muted dark:text-muted-foreground rounded text-xs">
                  iOS
                </span>
              )}
              {pwaData.deviceInfo.isAndroid && (
                <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">
                  Android
                </span>
              )}
              {pwaData.deviceInfo.isDesktop && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded text-xs">
                  Desktop
                </span>
              )}
              {pwaData.isMobile && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs">
                  Mobile
                </span>
              )}
            </div>
          </div>
        )}

        {pwaData.browserInfo && (
          <div className="pt-2 border-t">
            <span className="text-muted-foreground text-sm">Browser:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {pwaData.browserInfo.isChrome && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded text-xs">
                  Chrome
                </span>
              )}
              {pwaData.browserInfo.isSafari && (
                <span className="px-2 py-1 bg-muted text-foreground dark:bg-muted dark:text-muted-foreground rounded text-xs">
                  Safari
                </span>
              )}
              {pwaData.browserInfo.isFirefox && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs">
                  Firefox
                </span>
              )}
              {pwaData.browserInfo.isEdge && (
                <span className="px-2 py-1 bg-muted text-foreground dark:bg-muted dark:text-muted-foreground rounded text-xs">
                  Edge
                </span>
              )}
            </div>
          </div>
        )}

        {pwaData.installable && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                PWA Installable
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
