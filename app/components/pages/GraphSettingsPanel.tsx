"use client";

import React from 'react';
import MobileSlider from '../ui/MobileSlider';

interface GraphPhysicsSettings {
  chargeStrength: number;
  linkDistance: number;
  centerStrength: number;
  collisionRadius: number;
  alphaDecay: number;
  velocityDecay: number;
}

interface GraphSettingsPanelProps {
  settings?: GraphPhysicsSettings;
  onSettingsChange?: (settings: Partial<GraphPhysicsSettings>) => void;
  onReset?: () => void;
}

/**
 * GraphSettingsPanel Component
 * 
 * Physics settings panel for graph visualization
 * Used in fullscreen mode to preview changes in real-time
 */
export default function GraphSettingsPanel({
  settings = {
    chargeStrength: -300,
    linkDistance: 100,
    centerStrength: 0.3,
    collisionRadius: 30,
    alphaDecay: 0.0228,
    velocityDecay: 0.4
  },
  onSettingsChange = () => {},
  onReset = () => {}
}: GraphSettingsPanelProps) {

  const handleSettingChange = (key: keyof GraphPhysicsSettings, value: number) => {
    onSettingsChange({ [key]: value });
  };



  return (
    <div className="p-6" style={{ touchAction: 'pan-y' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Physics Settings</h3>
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ touchAction: 'manipulation' }}>
        <MobileSlider
          label="Node Repulsion"
          value={settings.chargeStrength}
          min={-500}
          max={-50}
          step={10}
          onChange={(value) => handleSettingChange('chargeStrength', value)}
          description="How strongly nodes push away from each other"
        />

        <MobileSlider
          label="Link Distance"
          value={settings.linkDistance}
          min={50}
          max={200}
          step={10}
          onChange={(value) => handleSettingChange('linkDistance', value)}
          description="Preferred distance between connected nodes"
        />

        <MobileSlider
          label="Center Pull"
          value={settings.centerStrength}
          min={0.1}
          max={1.0}
          step={0.1}
          onChange={(value) => handleSettingChange('centerStrength', value)}
          formatValue={(val) => val.toFixed(2)}
          description="How strongly nodes are pulled to center"
        />

        <MobileSlider
          label="Node Size"
          value={settings.collisionRadius}
          min={20}
          max={50}
          step={2}
          onChange={(value) => handleSettingChange('collisionRadius', value)}
          description="Collision radius around nodes"
        />

        <MobileSlider
          label="Simulation Speed"
          value={settings.alphaDecay}
          min={0.01}
          max={0.1}
          step={0.005}
          onChange={(value) => handleSettingChange('alphaDecay', value)}
          formatValue={(val) => val.toFixed(3)}
          description="How quickly the simulation settles"
        />

        <MobileSlider
          label="Damping"
          value={settings.velocityDecay}
          min={0.1}
          max={0.9}
          step={0.05}
          onChange={(value) => handleSettingChange('velocityDecay', value)}
          formatValue={(val) => val.toFixed(2)}
          description="How much velocity is retained each frame"
        />
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Adjust settings to see changes in the graph above in real-time.
      </div>
    </div>
  );
}
