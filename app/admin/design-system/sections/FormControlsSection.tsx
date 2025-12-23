"use client";

import React, { useState } from 'react';
import { Switch } from '../../../components/ui/switch';
import { Checkbox } from '../../../components/ui/checkbox';
import { ComponentShowcase, StateDemo } from './shared';

export function FormControlsSection({ id }: { id: string }) {
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <ComponentShowcase
      id={id}
      title="Form Controls"
      path="app/components/ui/"
      description="Interactive form elements including switches and checkboxes"
    >
      <StateDemo label="Switch Sizes">
        <div className="flex items-center space-x-3">
          <Switch
            id="switch-sm"
            size="sm"
            checked={switchChecked}
            onCheckedChange={setSwitchChecked}
          />
          <label htmlFor="switch-sm" className="text-sm">
            Small
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch
            id="switch-md"
            size="md"
            checked={switchChecked}
            onCheckedChange={setSwitchChecked}
          />
          <label htmlFor="switch-md" className="text-sm">
            Medium (default)
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch
            id="switch-lg"
            size="lg"
            checked={switchChecked}
            onCheckedChange={setSwitchChecked}
          />
          <label htmlFor="switch-lg" className="text-sm">
            Large
          </label>
        </div>
      </StateDemo>

      <StateDemo label="Switch States">
        <div className="flex items-center space-x-3">
          <Switch id="switch-off" checked={false} />
          <label htmlFor="switch-off" className="text-sm">
            Off State
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch id="switch-on" checked={true} />
          <label htmlFor="switch-on" className="text-sm">
            On State
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch id="disabled-switch-off" disabled checked={false} />
          <label htmlFor="disabled-switch-off" className="text-sm text-muted-foreground">
            Disabled Off
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch id="disabled-switch-on" disabled checked={true} />
          <label htmlFor="disabled-switch-on" className="text-sm text-muted-foreground">
            Disabled On
          </label>
        </div>
      </StateDemo>

      <StateDemo label="Checkbox">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="demo-checkbox"
            checked={checkboxChecked}
            onCheckedChange={setCheckboxChecked}
          />
          <label htmlFor="demo-checkbox" className="text-sm">
            {checkboxChecked ? 'Checked' : 'Unchecked'}
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="disabled-checkbox" disabled />
          <label htmlFor="disabled-checkbox" className="text-sm text-muted-foreground">
            Disabled Checkbox
          </label>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
