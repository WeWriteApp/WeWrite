"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader } from 'lucide-react';

/**
 * AdminChart Component
 * 
 * A reusable chart component for the admin dashboard that supports line, bar, and area charts.
 * 
 * @param {Object} props
 * @param {string} props.title - The chart title
 * @param {string} props.description - The chart description
 * @param {Array} props.data - The chart data
 * @param {string} props.type - The chart type (line, bar, area)
 * @param {string} props.dataKey - The data key to display
 * @param {string} props.color - The chart color
 * @param {boolean} props.loading - Whether the chart is loading
 * @param {string} props.timeRange - The current time range
 * @param {Function} props.onTimeRangeChange - Callback when time range changes
 * @param {Object} props.icon - Icon component to display in the title
 */
export default function AdminChart({
  title,
  description,
  data = [],
  type = 'line',
  dataKey = 'value',
  color = '#1768FF',
  loading = false,
  timeRange = 'all',
  onTimeRangeChange = () => {},
  icon
}) {
  // Format data for the chart if needed
  const chartData = data.map((value, index) => ({
    name: index.toString(),
    [dataKey]: value
  }));

  // Render the appropriate chart based on type
  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          No data available
        </div>
      );
    }

    return (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' && (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={dataKey} stroke={color} activeDot={{ r: 8 }} />
            </LineChart>
          )}
          {type === 'bar' && (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={dataKey} fill={color} />
            </BarChart>
          )}
          {type === 'area' && (
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.3} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {icon && <span className="h-5 w-5">{icon}</span>}
            <span>{title}</span>
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
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
