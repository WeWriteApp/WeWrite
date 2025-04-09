"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader, Smartphone, Monitor, TabletSmartphone } from 'lucide-react';

/**
 * DeviceUsageChart Component
 * 
 * A stacked area chart showing device usage over time.
 * 
 * @param {Object} props
 * @param {Object} props.data - The device usage data with desktop, mobileBrowser, and mobilePwa arrays
 * @param {boolean} props.loading - Whether the chart is loading
 * @param {string} props.timeRange - The current time range
 * @param {Function} props.onTimeRangeChange - Callback when time range changes
 */
export default function DeviceUsageChart({
  data = { desktop: [], mobileBrowser: [], mobilePwa: [] },
  loading = false,
  timeRange = 'all',
  onTimeRangeChange = () => {}
}) {
  // Format data for the stacked area chart
  const chartData = data.desktop.map((value, index) => ({
    name: index.toString(),
    Desktop: data.desktop[index] || 0,
    'Mobile Browser': data.mobileBrowser[index] || 0,
    'Mobile PWA': data.mobilePwa[index] || 0
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <span>Device Usage</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <button
              onClick={() => onTimeRangeChange('all')}
              className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
            >
              all
            </button>
            <span className="mx-1">|</span>
            <button
              onClick={() => onTimeRangeChange('24h')}
              className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
            >
              24h
            </button>
          </div>
        </CardTitle>
        <CardDescription>Active users by device type</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="Desktop" 
                  stackId="1" 
                  stroke="#4CAF50" 
                  fill="#4CAF50" 
                  fillOpacity={0.6} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Mobile Browser" 
                  stackId="1" 
                  stroke="#2196F3" 
                  fill="#2196F3" 
                  fillOpacity={0.6} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Mobile PWA" 
                  stackId="1" 
                  stroke="#9C27B0" 
                  fill="#9C27B0" 
                  fillOpacity={0.6} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
