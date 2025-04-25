"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Award, Flame } from 'lucide-react';
import { getUserStreaks } from '../firebase/streaks';
import { Skeleton } from './ui/skeleton';
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

/**
 * UserStreak component displays a user's writing streak information
 *
 * @param {Object} props
 * @param {string} props.userId - The user ID to display streaks for
 */
const UserStreak = ({ userId }) => {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStreakData = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const data = await getUserStreaks(userId);
        setStreakData(data);
      } catch (err) {
        console.error('Error fetching streak data:', err);
        setError('Failed to load streak data');
      } finally {
        setLoading(false);
      }
    };

    fetchStreakData();
  }, [userId]);

  if (loading) {
    return (
      <Card className="border border-border/40 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-border/40 bg-card">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Unable to load streak data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no streak data exists yet
  if (!streakData) {
    return (
      <Card className="border border-border/40 bg-card">
        <CardContent className="p-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>No writing activity yet</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Start writing to build your streak!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border border-border/40 bg-card">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Current Streak */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Current Streak</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 font-semibold">
                    <span className="text-foreground">{streakData.currentStreak}</span>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Days in a row with writing activity</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Longest Streak */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Longest Streak</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 font-semibold">
                    <span className="text-foreground">{streakData.longestStreak}</span>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your best writing streak so far</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Last Active */}
            {streakData.lastActiveDate && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Last active</span>
                </div>
                <span>{new Date(streakData.lastActiveDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default UserStreak;
