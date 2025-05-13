"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/database';
import { FeatureFlag } from '../utils/feature-flags';
import { Check, X, Code } from 'lucide-react';
import { Modal } from './ui/modal';
import { motion, useDragControls } from 'framer-motion';

export default function FeatureFlagDebuggerModal() {
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 100 });
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);

  useEffect(() => {
    // Set up a real-time listener for feature flag changes when modal is open
    if (isOpen) {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');

      const unsubscribe = onSnapshot(featureFlagsRef, (snapshot) => {
        if (snapshot.exists()) {
          const flagsData = snapshot.data();
          console.log('Feature flags from database:', flagsData);
          setFeatureFlags(flagsData);
        } else {
          console.log('No feature flags document found');
          setFeatureFlags({});
        }
        setLoading(false);
      }, (error) => {
        console.error('Error listening to feature flags:', error);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [isOpen]);

  const toggleFlag = async (flag: string, newValue?: boolean) => {
    try {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let flagsData = {};

      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
      }

      // Toggle the flag or set to specified value
      const updatedValue = newValue !== undefined ? newValue : !(flagsData[flag] === true);

      // Update the database
      await setDoc(featureFlagsRef, {
        ...flagsData,
        [flag]: updatedValue
      });

      console.log(`Feature flag ${flag} set to ${updatedValue}`);
    } catch (error) {
      console.error('Error toggling feature flag:', error);
    }
  };

  const toggleAllFlags = async (enabled: boolean) => {
    try {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let flagsData = {};

      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
      }

      // Create updated flags object with all flags set to the same value
      const updatedFlags = Object.keys(featureFlags).reduce((acc, flag) => {
        acc[flag] = enabled;
        return acc;
      }, {...flagsData});

      // Update the database
      await setDoc(featureFlagsRef, updatedFlags);

      console.log(`All feature flags set to ${enabled}`);
    } catch (error) {
      console.error('Error toggling all feature flags:', error);
    }
  };

  // Calculate if all flags are enabled
  const allFlagsEnabled = Object.values(featureFlags).every(value => value === true);

  // Handle hiding the button until next refresh
  const handleHideUntilRefresh = () => {
    setIsHidden(true);
    setIsOpen(false);
  };

  // Set up constraints for dragging
  useEffect(() => {
    const updateConstraints = () => {
      // This will run on mount and window resize
      setPosition(prev => ({
        x: Math.min(Math.max(prev.x, 0), window.innerWidth - 60),
        y: Math.min(Math.max(prev.y, 0), window.innerHeight - 60)
      }));
    };

    window.addEventListener('resize', updateConstraints);
    updateConstraints();

    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

  if (isHidden) {
    return null;
  }

  return (
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-50">
      {/* Floating Action Button */}
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragConstraints={constraintsRef}
        initial={position}
        animate={position}
        onDragEnd={(e, info) => {
          // Update position state after drag
          setPosition({
            x: Math.min(Math.max(info.point.x - 30, 0), window.innerWidth - 60),
            y: Math.min(Math.max(info.point.y - 30, 0), window.innerHeight - 60)
          });
        }}
        className="absolute pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          onClick={() => setIsOpen(true)}
        >
          <Code className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* Feature Flag Debugger Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Feature Flag Debugger"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Current Feature Flags:</h3>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
              {JSON.stringify(featureFlags, null, 2)}
            </pre>
          </div>

          <div className="flex flex-col gap-4">
            {/* All Flags Toggle */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-muted/30">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">All Feature Flags</span>
                </div>
                <span className="text-xs text-muted-foreground">Toggle all feature flags at once</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {allFlagsEnabled ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      All Enabled
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center">
                      <X className="h-3 w-3 mr-1" />
                      Mixed
                    </span>
                  )}
                </span>
                <Switch
                  checked={allFlagsEnabled}
                  onCheckedChange={(checked) => toggleAllFlags(checked)}
                />
              </div>
            </div>

            {/* Individual Flag Toggles */}
            <div className="space-y-2">
              {Object.entries(featureFlags).map(([flag, enabled]) => (
                <div
                  key={flag}
                  className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{flag}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {enabled ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center">
                          <Check className="h-3 w-3 mr-1" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 flex items-center">
                          <X className="h-3 w-3 mr-1" />
                          Disabled
                        </span>
                      )}
                    </span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => toggleFlag(flag, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hide until refresh button */}
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleHideUntilRefresh}
            >
              Hide until next refresh
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
