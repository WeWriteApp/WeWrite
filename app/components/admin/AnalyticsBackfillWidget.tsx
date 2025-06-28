"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Database, 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface BackfillStats {
  pagesProcessed: number;
  usersProcessed: number;
  dailyAggregationsCreated: number;
  hourlyAggregationsCreated: number;
  globalCountersUpdated: boolean;
  errors: number;
}

interface BackfillResult {
  success: boolean;
  message?: string;
  error?: string;
  stats?: BackfillStats;
}

export function AnalyticsBackfillWidget() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [batchSize, setBatchSize] = useState(100);

  const runBackfill = async () => {
    if (!user) return;

    setIsRunning(true);
    setResult(null);

    try {
      // Get the user's ID token for authentication
      // Import Firebase auth to get the current user's token
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const token = await currentUser.getIdToken();

      const response = await fetch('/api/admin/backfill-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dryRun,
          batchSize
        })
      });

      const data = await response.json();
      setResult(data);

    } catch (error) {
      console.error('Error running analytics backfill:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Analytics Data Backfill</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Backfill missing historical analytics data including:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Global counters (total pages, active pages, etc.)</li>
            <li>Daily aggregations from page creation data</li>
            <li>Hourly aggregations for recent activity</li>
          </ul>
        </div>

        {/* Configuration Options */}
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dryRun" 
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(checked as boolean)}
            />
            <Label htmlFor="dryRun" className="text-sm">
              Dry run (preview only, don't write data)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batchSize" className="text-sm">
              Batch size (documents per batch)
            </Label>
            <Input
              id="batchSize"
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
              min={10}
              max={500}
              className="w-24"
            />
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={runBackfill}
          disabled={isRunning}
          className="w-full"
          variant={dryRun ? "outline" : "default"}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running {dryRun ? 'Preview' : 'Backfill'}...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {dryRun ? 'Preview Backfill' : 'Run Backfill'}
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? 'Success' : 'Failed'}
              </span>
            </div>

            {result.message && (
              <p className="text-sm text-muted-foreground">{result.message}</p>
            )}

            {result.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{result.error}</p>
              </div>
            )}

            {result.stats && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-medium">Statistics</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Pages processed:</span>
                    <Badge variant="secondary">{result.stats.pagesProcessed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Users processed:</span>
                    <Badge variant="secondary">{result.stats.usersProcessed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily aggregations:</span>
                    <Badge variant="secondary">{result.stats.dailyAggregationsCreated}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Hourly aggregations:</span>
                    <Badge variant="secondary">{result.stats.hourlyAggregationsCreated}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Global counters:</span>
                    <Badge variant={result.stats.globalCountersUpdated ? "default" : "secondary"}>
                      {result.stats.globalCountersUpdated ? 'Updated' : 'Not updated'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Errors:</span>
                    <Badge variant={result.stats.errors > 0 ? "destructive" : "secondary"}>
                      {result.stats.errors}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning for non-dry runs */}
        {!dryRun && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Warning</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              This will write data to the database. Run a dry run first to preview the changes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
