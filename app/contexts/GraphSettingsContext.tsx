"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface GraphPhysicsSettings {
  chargeStrength: number;        // Node repulsion (-50 to -500)
  linkDistance: number;          // Link length (50 to 200)
  centerStrength: number;        // Center force (0.1 to 1.0)
  collisionRadius: number;       // Node collision (20 to 50)
  alphaDecay: number;           // Simulation decay (0.01 to 0.1)
  velocityDecay: number;        // Velocity damping (0.1 to 0.9)
}

export interface GraphSettingsContextType {
  settings: GraphPhysicsSettings;
  updateSettings: (newSettings: Partial<GraphPhysicsSettings>) => void;
  resetToDefaults: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const defaultSettings: GraphPhysicsSettings = {
  chargeStrength: -200,    // Reduced repulsion so nodes don't spread to edges
  linkDistance: 80,        // Shorter links to keep connected nodes closer
  centerStrength: 0.6,     // Stronger center force to pull nodes toward middle
  collisionRadius: 25,     // Smaller collision radius for tighter clustering
  alphaDecay: 0.0228,
  velocityDecay: 0.4
};

const GraphSettingsContext = createContext<GraphSettingsContextType | undefined>(undefined);

export function GraphSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<GraphPhysicsSettings>(() => {
    // Load settings from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('graph-physics-settings');
        if (saved) {
          return { ...defaultSettings, ...JSON.parse(saved) };
        }
      } catch (error) {
        console.warn('Failed to load graph settings from localStorage:', error);
      }
    }
    return defaultSettings;
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const updateSettings = useCallback((newSettings: Partial<GraphPhysicsSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('graph-physics-settings', JSON.stringify(updated));
        } catch (error) {
          console.warn('Failed to save graph settings to localStorage:', error);
        }
      }
      
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('graph-physics-settings');
      } catch (error) {
        console.warn('Failed to clear graph settings from localStorage:', error);
      }
    }
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <GraphSettingsContext.Provider value={{
      settings,
      updateSettings,
      resetToDefaults,
      isDrawerOpen,
      openDrawer,
      closeDrawer
    }}>
      {children}
    </GraphSettingsContext.Provider>
  );
}

export function useGraphSettings() {
  const context = useContext(GraphSettingsContext);
  if (context === undefined) {
    throw new Error('useGraphSettings must be used within a GraphSettingsProvider');
  }
  return context;
}

/**
 * GraphSettingsDrawer Component
 * 
 * Bottom drawer with physics sliders that affect all graphs
 */
export function GraphSettingsDrawer() {
  const { settings, updateSettings, resetToDefaults, isDrawerOpen, closeDrawer } = useGraphSettings();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={closeDrawer}>
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background border-t-only rounded-t-lg shadow-lg max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Graph Physics Settings</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={resetToDefaults}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to defaults
              </button>
              <button
                onClick={closeDrawer}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
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
                onChange={(e) => updateSettings({ chargeStrength: parseInt(e.target.value) })}
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
                onChange={(e) => updateSettings({ linkDistance: parseInt(e.target.value) })}
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
                onChange={(e) => updateSettings({ centerStrength: parseFloat(e.target.value) })}
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
                onChange={(e) => updateSettings({ collisionRadius: parseInt(e.target.value) })}
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
                onChange={(e) => updateSettings({ alphaDecay: parseFloat(e.target.value) })}
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
                onChange={(e) => updateSettings({ velocityDecay: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">How much velocity is retained each frame</p>
            </div>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Settings are automatically saved and applied to all graphs in real-time.
          </div>
        </div>
      </div>
    </div>
  );
}
