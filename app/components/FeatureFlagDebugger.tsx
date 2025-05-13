"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/database';
import { FeatureFlag } from '../utils/feature-flags';

export default function FeatureFlagDebugger() {
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up a real-time listener for feature flag changes
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
  }, []);

  const toggleFlag = async (flag: string) => {
    try {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);
      
      let flagsData = {};
      
      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
      }
      
      // Toggle the flag
      const newValue = !(flagsData[flag] === true);
      
      // Update the database
      await setDoc(featureFlagsRef, {
        ...flagsData,
        [flag]: newValue
      });
      
      console.log(`Feature flag ${flag} toggled to ${newValue}`);
    } catch (error) {
      console.error('Error toggling feature flag:', error);
    }
  };

  const forceEnableGroups = async () => {
    try {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);
      
      let flagsData = {};
      
      if (featureFlagsDoc.exists()) {
        flagsData = featureFlagsDoc.data();
      }
      
      // Force enable the groups flag
      await setDoc(featureFlagsRef, {
        ...flagsData,
        groups: true
      });
      
      console.log('Groups feature flag forced to enabled');
      
      // Force reload the page to ensure all components pick up the change
      window.location.reload();
    } catch (error) {
      console.error('Error forcing groups feature flag:', error);
    }
  };

  if (loading) {
    return <div>Loading feature flags...</div>;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Feature Flag Debugger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Current Feature Flags:</h3>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto">
              {JSON.stringify(featureFlags, null, 2)}
            </pre>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={forceEnableGroups}
              variant="default"
            >
              Force Enable Groups Feature
            </Button>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(featureFlags).map(([flag, enabled]) => (
                <Button 
                  key={flag}
                  onClick={() => toggleFlag(flag)}
                  variant={enabled ? "default" : "outline"}
                  size="sm"
                >
                  {flag}: {enabled ? 'ON' : 'OFF'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
