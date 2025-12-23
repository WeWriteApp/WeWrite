"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useAuth } from '../../providers/AuthProvider';
import { followUser, isFollowingUser } from '../../firebase/follows';
import { useToast } from '../ui/use-toast';
import Link from 'next/link';

interface UserSuggestion {
  id: string;
  username: string;
  recentPages: {
    id: string;
    title: string;
    lastModified: Date;
  }[];
}

interface FollowUsersCardProps {
  onDismiss: () => void;
}

export function FollowUsersCard({ onDismiss }: FollowUsersCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [followingLoading, setFollowingLoading] = useState<Record<string, boolean>>({});

  // Fetch user suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch('/api/user-suggestions');
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        
        const data = await response.json();
        setSuggestions(data.suggestions || []);

        // Check follow status for each suggestion
        const followStates: Record<string, boolean> = {};
        for (const suggestion of data.suggestions || []) {
          const isFollowing = await isFollowingUser(user.uid, suggestion.id);
          followStates[suggestion.id] = isFollowing;
        }
        setFollowingStates(followStates);
      } catch (error) {
        console.error('Error fetching user suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user?.uid]);

  const handleFollow = async (userId: string) => {
    if (!user?.uid) return;

    setFollowingLoading(prev => ({ ...prev, [userId]: true }));

    try {
      await followUser(user.uid, userId);
      setFollowingStates(prev => ({ ...prev, [userId]: true }));
      
      toast({
        title: "User followed",
        description: "You'll now see their activity in your feed.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error following user:', error);
      toast({
        title: "Error",
        description: "Failed to follow user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFollowingLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <Icon name="Loader" size={24} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="UserPlus" size={20} className="text-primary" />
            <h3 className="font-semibold">Follow Users</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
          >
            <Icon name="X" size={16} />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Discover interesting writers and follow them to see their activity in your feed.
        </p>

        <div className="space-y-4">
          {suggestions.slice(0, 3).map((suggestion) => (
            <div key={suggestion.id} className="border rounded-lg p-4">
              {/* User Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium">@{suggestion.username}</h4>
                </div>
              </div>

              {/* Recent Pages */}
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Icon name="Clock" size={12} />
                  Recent pages
                </p>
                <div className="space-y-1">
                  {suggestion.recentPages.slice(0, 3).map((page) => (
                    <Link
                      key={page.id}
                      href={`/${page.id}`}
                      className="block text-sm hover:text-primary transition-colors truncate"
                    >
                      {page.title || 'Untitled'}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Follow Button */}
              <Button
                onClick={() => handleFollow(suggestion.id)}
                disabled={followingStates[suggestion.id] || followingLoading[suggestion.id]}
                className="w-full"
                size="sm"
              >
                {followingLoading[suggestion.id] ? (
                  <Icon name="Loader" size={16} />
                ) : followingStates[suggestion.id] ? (
                  'Following'
                ) : (
                  'Follow'
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
