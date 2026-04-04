"use client";

import React, { useState } from 'react';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { ComponentShowcase, StateDemo } from './shared';

export function FormControlsSection({ id }: { id: string }) {
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option-1');

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

      <StateDemo label="Radio Group">
        <RadioGroup value={radioValue} onValueChange={setRadioValue}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-1" id="radio-1" />
            <label htmlFor="radio-1" className="text-sm">Option 1</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-2" id="radio-2" />
            <label htmlFor="radio-2" className="text-sm">Option 2</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-3" id="radio-3" />
            <label htmlFor="radio-3" className="text-sm">Option 3</label>
          </div>
        </RadioGroup>
        <span className="text-sm text-muted-foreground ml-2">Selected: {radioValue}</span>
      </StateDemo>

      <StateDemo label="Disabled Radio">
        <RadioGroup defaultValue="disabled-1" disabled>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="disabled-1" id="radio-d1" />
            <label htmlFor="radio-d1" className="text-sm text-muted-foreground">Disabled Selected</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="disabled-2" id="radio-d2" />
            <label htmlFor="radio-d2" className="text-sm text-muted-foreground">Disabled Unselected</label>
          </div>
        </RadioGroup>
      </StateDemo>
    </ComponentShowcase>
  );
}
