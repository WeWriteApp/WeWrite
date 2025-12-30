"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from "../ui/button";
import { InlineError } from '../ui/InlineError';
import { followsApi } from "../../utils/apiClient";
import { useAuth } from '../../providers/AuthProvider';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useAlert } from '../../hooks/useAlert';
import { AlertModal } from './UnifiedModal';

interface SuggestedUser {
  id: string;
  username: string;
  photoURL?: string;
  bio?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  followerCount?: number;
  source: 'related' | 'discover';
  score: number;
}

interface FollowingSuggestionsProps {
  limit?: number;
}

export default function FollowingSuggestions({ limit = 10 }: FollowingSuggestionsProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const { alertState, showError, closeAlert } = useAlert();

  useEffect(() => {
    if (!user) return;
    loadSuggestions();
  }, [user]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await followsApi.getFollowSuggestions(limit);

      if (!response.success || !response.data?.suggestions) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setSuggestions(response.data.suggestions);
    } catch (err) {
      console.error('Error loading follow suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;

    try {
      // Optimistically update UI
      setFollowingIds(prev => new Set([...prev, userId]));

      const response = await followsApi.followUser(userId);

      if (!response.success) {
        // Revert on failure
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        throw new Error(response.error || 'Failed to follow writer');
      }

      // Remove from suggestions after successful follow
      setSuggestions(prev => prev.filter(s => s.id !== userId));
    } catch (err) {
      console.error('Error following user:', err);
      await showError('Follow Failed', 'Failed to follow writer. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Suggestions</h3>
        <div className="flex justify-center py-6">
          <Icon name="Loader" className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Suggestions</h3>
        <InlineError
          variant="card"
          message={error}
        />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't show section if no suggestions
  }

  // Group suggestions by source
  const relatedSuggestions = suggestions.filter(s => s.source === 'related');
  const discoverSuggestions = suggestions.filter(s => s.source === 'discover');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Suggestions</h3>

      {/* Related suggestions (from your network) */}
      {relatedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Followed by people you follow
          </p>
          <div className="space-y-2">
            {relatedSuggestions.map(suggestedUser => (
              <SuggestionCard
                key={suggestedUser.id}
                user={suggestedUser}
                onFollow={handleFollow}
                isFollowing={followingIds.has(suggestedUser.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Discover suggestions (random/popular) */}
      {discoverSuggestions.length > 0 && (
        <div className="space-y-2">
          {relatedSuggestions.length > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Discover more writers
            </p>
          )}
          <div className="space-y-2">
            {discoverSuggestions.map(suggestedUser => (
              <SuggestionCard
                key={suggestedUser.id}
                user={suggestedUser}
                onFollow={handleFollow}
                isFollowing={followingIds.has(suggestedUser.id)}
              />
            ))}
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </div>
  );
}

interface SuggestionCardProps {
  user: SuggestedUser;
  onFollow: (userId: string) => void;
  isFollowing: boolean;
}

function SuggestionCard({ user, onFollow, isFollowing }: SuggestionCardProps) {
  return (
    <div className="wewrite-card flex items-center justify-between p-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <UsernameBadge
          userId={user.id}
          username={user.username}
          tier={user.tier}
          subscriptionStatus={user.subscriptionStatus}
          subscriptionAmount={user.subscriptionAmount}
          variant="pill"
          pillVariant="primary"
          size="md"
        />
        {user.bio && (
          <span className="text-sm text-muted-foreground truncate hidden sm:block">
            {user.bio.length > 50 ? `${user.bio.slice(0, 50)}...` : user.bio}
          </span>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onFollow(user.id)}
        disabled={isFollowing}
        className="flex-shrink-0"
      >
        {isFollowing ? (
          <>
            <Icon name="Loader" size={16} className="mr-1" />
            Following...
          </>
        ) : (
          'Follow'
        )}
      </Button>
    </div>
  );
}
