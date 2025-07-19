"use client";

import React from 'react';

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Physics Settings</h3>
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Charge Strength */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Node Repulsion: {settings.chargeStrength}
          </label>
          <input
            type="range"
            min="-500"
            max="-50"
            step="10"
            value={settings.chargeStrength}
            onChange={(e) => handleSettingChange('chargeStrength', parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">How strongly nodes push away from each other</p>
        </div>

        {/* Link Distance */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Link Distance: {settings.linkDistance}
          </label>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={settings.linkDistance}
            onChange={(e) => handleSettingChange('linkDistance', parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Preferred distance between connected nodes</p>
        </div>

        {/* Center Strength */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Center Pull: {settings.centerStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={settings.centerStrength}
            onChange={(e) => handleSettingChange('centerStrength', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">How strongly nodes are pulled to center</p>
        </div>

        {/* Collision Radius */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Node Size: {settings.collisionRadius}
          </label>
          <input
            type="range"
            min="20"
            max="50"
            step="2"
            value={settings.collisionRadius}
            onChange={(e) => handleSettingChange('collisionRadius', parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Collision radius around nodes</p>
        </div>

        {/* Alpha Decay */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Simulation Speed: {settings.alphaDecay.toFixed(3)}
          </label>
          <input
            type="range"
            min="0.01"
            max="0.1"
            step="0.005"
            value={settings.alphaDecay}
            onChange={(e) => handleSettingChange('alphaDecay', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">How quickly the simulation settles</p>
        </div>

        {/* Velocity Decay */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Damping: {settings.velocityDecay.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={settings.velocityDecay}
            onChange={(e) => handleSettingChange('velocityDecay', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">How much velocity is retained each frame</p>
        </div>
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Adjust settings to see changes in the graph above in real-time.
      </div>
    </div>
  );
}
