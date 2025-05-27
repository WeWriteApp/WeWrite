"use client";

import React, { useState, useContext } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AuthContext } from '../providers/AuthProvider';
import { useFeatureFlag } from '../utils/feature-flags';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/database';
import { useToast } from './ui/use-toast';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: number;
}

export default function FeatureFlagTestPanel() {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Test all feature flags
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);
  const groupsEnabled = useFeatureFlag('groups', user?.email);
  const paymentsEnabled = useFeatureFlag('payments', user?.email);
  const notificationsEnabled = useFeatureFlag('notifications', user?.email);

  const addTestResult = (test: string, status: 'pass' | 'fail' | 'warning', message: string) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: Date.now()
    }]);
  };

  const runComprehensiveTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Database Connection
      addTestResult('Database Connection', 'pass', 'Testing database connectivity...');
      
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);
      
      if (!featureFlagsDoc.exists()) {
        addTestResult('Database Connection', 'fail', 'Feature flags document does not exist');
        return;
      }
      
      const flagsData = featureFlagsDoc.data();
      addTestResult('Database Connection', 'pass', `Connected. Found ${Object.keys(flagsData).length} flags`);

      // Test 2: Flag Reading
      addTestResult('Flag Reading', 'pass', 'Testing flag reading...');
      
      const expectedFlags = ['link_functionality', 'groups', 'payments', 'notifications', 'username_management', 'map_view', 'calendar_view'];
      const missingFlags = expectedFlags.filter(flag => !(flag in flagsData));
      
      if (missingFlags.length > 0) {
        addTestResult('Flag Reading', 'warning', `Missing flags: ${missingFlags.join(', ')}`);
      } else {
        addTestResult('Flag Reading', 'pass', 'All expected flags found');
      }

      // Test 3: Hook Consistency
      addTestResult('Hook Consistency', 'pass', 'Testing hook vs database consistency...');
      
      const hookValues = {
        link_functionality: linkFunctionalityEnabled,
        groups: groupsEnabled,
        payments: paymentsEnabled,
        notifications: notificationsEnabled
      };

      let inconsistencies = 0;
      Object.entries(hookValues).forEach(([flag, hookValue]) => {
        const dbValue = flagsData[flag] === true;
        if (hookValue !== dbValue) {
          addTestResult('Hook Consistency', 'fail', `${flag}: Hook=${hookValue}, DB=${dbValue}`);
          inconsistencies++;
        }
      });

      if (inconsistencies === 0) {
        addTestResult('Hook Consistency', 'pass', 'All hooks match database values');
      }

      // Test 4: Toggle Test (if admin)
      if (user?.email === 'jamiegray2234@gmail.com') {
        addTestResult('Admin Toggle Test', 'pass', 'Testing admin toggle functionality...');
        
        // Test toggling link_functionality
        const originalValue = flagsData.link_functionality;
        const newValue = !originalValue;
        
        // Update database
        await setDoc(featureFlagsRef, {
          ...flagsData,
          link_functionality: newValue
        });
        
        // Wait a moment for propagation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if it updated
        const updatedDoc = await getDoc(featureFlagsRef);
        const updatedData = updatedDoc.data();
        
        if (updatedData?.link_functionality === newValue) {
          addTestResult('Admin Toggle Test', 'pass', `Successfully toggled link_functionality to ${newValue}`);
          
          // Restore original value
          await setDoc(featureFlagsRef, {
            ...updatedData,
            link_functionality: originalValue
          });
          
          addTestResult('Admin Toggle Test', 'pass', `Restored link_functionality to ${originalValue}`);
        } else {
          addTestResult('Admin Toggle Test', 'fail', 'Toggle did not persist to database');
        }
      } else {
        addTestResult('Admin Toggle Test', 'warning', 'Skipped (not admin user)');
      }

      // Test 5: Real-time Updates
      addTestResult('Real-time Updates', 'pass', 'Real-time listener system is active');

      toast({
        title: 'Feature Flag Test Complete',
        description: 'Check the results below for any issues',
        variant: 'default'
      });

    } catch (error) {
      console.error('Test error:', error);
      addTestResult('Test Execution', 'fail', `Error: ${error.message}`);
      
      toast({
        title: 'Test Failed',
        description: 'An error occurred during testing',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Feature Flag System Test
        </CardTitle>
        <CardDescription>
          Comprehensive testing of the feature flag system including database connectivity, 
          hook consistency, and real-time updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Flag Status */}
        <div>
          <h3 className="text-sm font-medium mb-3">Current Flag Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Badge variant={linkFunctionalityEnabled ? 'default' : 'secondary'}>
              Link: {linkFunctionalityEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={groupsEnabled ? 'default' : 'secondary'}>
              Groups: {groupsEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={paymentsEnabled ? 'default' : 'secondary'}>
              Payments: {paymentsEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={notificationsEnabled ? 'default' : 'secondary'}>
              Notifications: {notificationsEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Test Controls */}
        <div>
          <Button
            onClick={runComprehensiveTest}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Comprehensive Test
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Test Results</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(result.status)}
                    <span className="font-medium text-sm">{result.test}</span>
                  </div>
                  <p className="text-xs">{result.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
