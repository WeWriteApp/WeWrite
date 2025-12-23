"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Alert, AlertTitle, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

export function AlertSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Alert"
      path="@/components/ui/alert"
      description="Alert banners for displaying important messages with different severity levels. Supports dark mode."
    >
      <StateDemo label="All Variants">
        <div className="w-full space-y-3">
          <Alert>
            <Icon name="Info" size={16} />
            <AlertDescription>
              Default alert for general information messages.
            </AlertDescription>
          </Alert>

          <Alert variant="info">
            <Icon name="Info" size={16} />
            <AlertDescription>
              Info alert for helpful tips and guidance.
            </AlertDescription>
          </Alert>

          <Alert variant="success">
            <Icon name="CheckCircle" size={16} />
            <AlertDescription>
              Success alert for confirmations and completed actions.
            </AlertDescription>
          </Alert>

          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Warning alert for important notices that need attention.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Destructive alert for errors and critical issues.
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>

      <StateDemo label="With Title">
        <div className="w-full space-y-3">
          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertTitle>Subscription Inactive</AlertTitle>
            <AlertDescription>
              Your subscription is currently inactive. Reactivate to continue using premium features.
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>

      <StateDemo label="With Action Button">
        <div className="w-full">
          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
              <span>Your subscription is currently inactive.</span>
              <Button variant="default" size="sm" className="shrink-0 w-full sm:w-auto">
                Reactivate Subscription
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
