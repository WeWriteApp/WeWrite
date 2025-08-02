'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Calendar } from 'lucide-react';

// Test component to verify the loading state structure
export default function TestSpendLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Loading state for allocation display */}
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state for countdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next payment
          </CardTitle>
          <CardDescription>
            Loading payment information...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
            </div>
            <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state for breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakdown</CardTitle>
          <CardDescription>
            Loading your allocations...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="h-7 w-7 bg-muted rounded"></div>
                    <div className="h-7 w-7 bg-muted rounded"></div>
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
