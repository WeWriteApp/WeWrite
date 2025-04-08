"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loader } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Component to display a sparkline of user's recent activity
 */
export default function UserActivitySparkline({ userId, className }) {
  const [activityData, setActivityData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Number of days to show in the sparkline
  const daysToShow = 14;
  
  useEffect(() => {
    const fetchUserActivity = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        
        // Calculate date range (last 14 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysToShow);
        
        // Query pages created by the user in the last 14 days
        const pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          orderBy('createdAt', 'asc'),
          limit(100)
        );
        
        const pagesSnapshot = await getDocs(pagesQuery);
        
        // Create an array of dates with activity counts
        const activityByDay = Array(daysToShow).fill(0);
        
        pagesSnapshot.forEach(doc => {
          const pageData = doc.data();
          if (pageData.createdAt) {
            const createdDate = pageData.createdAt.toDate();
            const dayIndex = Math.floor((createdDate - startDate) / (1000 * 60 * 60 * 24));
            
            if (dayIndex >= 0 && dayIndex < daysToShow) {
              activityByDay[dayIndex]++;
            }
          }
        });
        
        setActivityData(activityByDay);
      } catch (error) {
        console.error('Error fetching user activity:', error);
        setError(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserActivity();
  }, [userId]);
  
  // Calculate the maximum value for scaling
  const maxValue = Math.max(...activityData, 1);
  
  // If loading, show a spinner
  if (isLoading) {
    return (
      <div className={cn("flex justify-center items-center h-8", className)}>
        <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // If error, show nothing
  if (error) {
    return null;
  }
  
  // If no activity, show a flat line
  if (activityData.every(value => value === 0)) {
    return (
      <div className={cn("h-8 flex items-center", className)}>
        <div className="w-full h-px bg-muted-foreground/20"></div>
      </div>
    );
  }
  
  // Calculate the SVG dimensions
  const height = 20;
  const width = daysToShow * 4; // 4px per day
  
  // Generate the sparkline path
  const points = activityData.map((value, index) => {
    const x = index * 4;
    const y = height - (value / maxValue) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className={cn("h-8 flex items-center justify-center", className)}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Line connecting all points */}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />
        
        {/* Dots for each data point with activity */}
        {activityData.map((value, index) => {
          if (value > 0) {
            const x = index * 4;
            const y = height - (value / maxValue) * height;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="2"
                className="fill-primary"
              />
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
