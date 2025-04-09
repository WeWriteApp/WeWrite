"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader, SortAsc } from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';

export default function SortPreferenceChart() {
  const [sortData, setSortData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  
  // Fetch sort preference data
  useEffect(() => {
    const fetchSortPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real implementation, this would query a dedicated collection
        // For now, we'll generate mock data
        const mockData = [
          { id: 'newest', name: 'Newest', count: 85, changedFromDefault: false },
          { id: 'oldest', name: 'Oldest', count: 12, changedFromDefault: true },
          { id: 'recently_edited', name: 'Recently Edited', count: 28, changedFromDefault: true },
          { id: 'most_views', name: 'Most Views', count: 35, changedFromDefault: true },
          { id: 'alpha_asc', name: 'A-Z', count: 18, changedFromDefault: true },
          { id: 'alpha_desc', name: 'Z-A', count: 7, changedFromDefault: true },
        ];
        
        // Filter data if showing only changed preferences
        const filteredData = showOnlyChanged 
          ? mockData.filter(item => item.changedFromDefault)
          : mockData;
        
        setSortData(filteredData);
      } catch (error) {
        console.error('Error fetching sort preferences:', error);
        setError('Failed to load sort preference data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSortPreferences();
  }, [timeRange, showOnlyChanged]);
  
  // Format data for the chart
  const chartData = sortData.map(item => ({
    name: item.name,
    users: item.count
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SortAsc className="h-5 w-5" />
          Sort Preferences
        </CardTitle>
        <CardDescription>
          How users prefer to sort their pages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="all">All Time</TabsTrigger>
              <TabsTrigger value="month">Past Month</TabsTrigger>
              <TabsTrigger value="week">Past Week</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center space-x-2">
            <Switch 
              id="show-changed" 
              checked={showOnlyChanged} 
              onCheckedChange={setShowOnlyChanged} 
            />
            <Label htmlFor="show-changed">Show only changed from default</Label>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-destructive text-center h-64 flex items-center justify-center">
            {error}
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#1768FF" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
