"use client";

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { useSyncQueue } from '../../contexts/SyncQueueContext';
import { clearCompletedOperations } from '../../utils/syncQueue';
import { toast } from '../ui/use-toast';

export function SyncQueueSettings() {
  const { state, queueCount, isEmailVerified, shouldUseQueue, triggerSync, refreshState } = useSyncQueue();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await triggerSync();
      toast({
        title: "Sync completed",
        description: "All pending changes have been processed.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "There was an error syncing your changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleClearCompleted = () => {
    clearCompletedOperations();
    refreshState();
    toast({
      title: "Completed operations cleared",
      description: "Successfully removed completed operations from the queue.",
      variant: "default"
    });
  };

  const getVerificationStatusIcon = () => {
    if (isEmailVerified) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getVerificationStatusText = () => {
    if (isEmailVerified) {
      return "Verified";
    }
    return "Unverified";
  };

  const getConnectionStatusIcon = () => {
    if (state.isOnline) {
      return <Wifi className="h-5 w-5 text-green-600" />;
    }
    return <WifiOff className="h-5 w-5 text-red-600" />;
  };

  const getConnectionStatusText = () => {
    return state.isOnline ? "Online" : "Offline";
  };

  const pendingOperations = state.operations.filter(op => op.status === 'pending');
  const completedOperations = state.operations.filter(op => op.status === 'completed');
  const failedOperations = state.operations.filter(op => op.status === 'failed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Sync Queue</span>
        </CardTitle>
        <CardDescription>
          Manage your offline changes and sync status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            {getVerificationStatusIcon()}
            <div>
              <p className="text-sm font-medium">Email Status</p>
              <p className="text-sm text-muted-foreground">{getVerificationStatusText()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon()}
            <div>
              <p className="text-sm font-medium">Connection</p>
              <p className="text-sm text-muted-foreground">{getConnectionStatusText()}</p>
            </div>
          </div>
        </div>

        {/* Queue Statistics */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingOperations.length}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{completedOperations.length}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{failedOperations.length}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Queue Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleManualSync}
            disabled={isManualSyncing || state.isSyncing || !state.isOnline || !isEmailVerified || pendingOperations.length === 0}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isManualSyncing || state.isSyncing ? 'animate-spin' : ''}`} />
            {isManualSyncing || state.isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleClearCompleted}
            disabled={completedOperations.length === 0}
            className="flex-1"
          >
            Clear Completed
          </Button>
        </div>

        {/* Sync Information */}
        {shouldUseQueue && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {!isEmailVerified && "Your changes are being queued until email verification is complete. "}
              {!state.isOnline && "You're offline. Changes will sync when connection is restored. "}
              {queueCount > 0 && `You have ${queueCount} change${queueCount !== 1 ? 's' : ''} waiting to be synced.`}
            </p>
          </div>
        )}

        {/* Last Sync Information */}
        {state.lastSyncAttempt && (
          <div className="text-sm text-muted-foreground">
            Last sync attempt: {new Date(state.lastSyncAttempt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
