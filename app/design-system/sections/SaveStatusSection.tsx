"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import AutoSaveIndicator, { SaveStatus } from '../../components/layout/AutoSaveIndicator';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';

interface SaveStatusSectionProps {
  id: string;
}

export function SaveStatusSection({ id }: SaveStatusSectionProps) {
  const [manualStatus, setManualStatus] = useState<SaveStatus>('pending');
  const [autoLoop, setAutoLoop] = useState(true);
  const [loopStatus, setLoopStatus] = useState<SaveStatus>('pending');
  const [loopSpeed, setLoopSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  // Speed settings in ms
  const speedSettings = {
    slow: { pending: 3000, saving: 2000, saved: 2500 },
    normal: { pending: 2000, saving: 1000, saved: 1500 },
    fast: { pending: 800, saving: 500, saved: 700 }
  };

  // Looping demo
  useEffect(() => {
    if (!autoLoop) return;

    const speeds = speedSettings[loopSpeed];
    let timeout: NodeJS.Timeout;

    const cycle = () => {
      // pending -> saving -> saved -> pending
      if (loopStatus === 'pending') {
        timeout = setTimeout(() => setLoopStatus('saving'), speeds.pending);
      } else if (loopStatus === 'saving') {
        timeout = setTimeout(() => setLoopStatus('saved'), speeds.saving);
      } else if (loopStatus === 'saved') {
        timeout = setTimeout(() => setLoopStatus('pending'), speeds.saved);
      }
    };

    cycle();
    return () => clearTimeout(timeout);
  }, [autoLoop, loopStatus, loopSpeed]);

  const statusOptions: SaveStatus[] = ['pending', 'saving', 'saved', 'error'];

  return (
    <section id={id} className="scroll-mt-4 md:scroll-mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
        <Icon name="Save" size={20} className="text-primary" />
        <h2 className="text-lg md:text-xl font-semibold">Save Status Indicator</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4 md:mb-6">
        Smooth animated transitions between save states: unsaved → saving → saved.
        Uses framer-motion for crossfade animations.
      </p>

      <div className="space-y-4 md:space-y-6">
        {/* Looping Demo */}
        <div className="wewrite-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Auto-cycling Demo</h3>
            <div className="flex items-center gap-3">
              <Label htmlFor="auto-loop" className="text-sm text-muted-foreground">
                Auto-loop
              </Label>
              <Switch
                id="auto-loop"
                checked={autoLoop}
                onCheckedChange={setAutoLoop}
                className="shrink-0"
              />
            </div>
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Speed:</span>
            <div className="flex gap-1">
              {(['slow', 'normal', 'fast'] as const).map((speed) => (
                <Button
                  key={speed}
                  variant={loopSpeed === speed ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLoopSpeed(speed)}
                  className="capitalize"
                >
                  {speed}
                </Button>
              ))}
            </div>
          </div>

          {/* The looping indicator */}
          <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-center min-h-[60px]">
            <AutoSaveIndicator
              status={loopStatus}
              lastSavedAt={loopStatus === 'saved' ? new Date() : null}
            />
          </div>
        </div>

        {/* Manual Status Picker */}
        <div className="wewrite-card">
          <h3 className="font-medium mb-4">Individual States</h3>

          <div className="flex flex-wrap gap-2 mb-4">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={manualStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setManualStatus(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-center min-h-[60px]">
            <AutoSaveIndicator
              status={manualStatus}
              lastSavedAt={manualStatus === 'saved' ? new Date() : null}
              error={manualStatus === 'error' ? 'Network error' : undefined}
            />
          </div>
        </div>

        {/* All States Side by Side */}
        <div className="wewrite-card">
          <h3 className="font-medium mb-4">All States</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusOptions.map((status) => (
              <div key={status} className="text-center">
                <div className="text-xs text-muted-foreground mb-2 capitalize">{status}</div>
                <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-center min-h-[48px]">
                  <AutoSaveIndicator
                    status={status}
                    lastSavedAt={status === 'saved' ? new Date() : null}
                    error={status === 'error' ? 'Failed' : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Example */}
        <div className="wewrite-card">
          <h3 className="font-medium mb-3">Usage</h3>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`import AutoSaveIndicator from '@/components/layout/AutoSaveIndicator';

<AutoSaveIndicator
  status="pending" // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  lastSavedAt={new Date()}
  error="Optional error message"
/>`}
          </pre>
        </div>
      </div>
    </section>
  );
}
