'use client';

/**
 * SecurityContent Component
 *
 * Displays device sessions and security settings for the user.
 * Shows all logged-in devices with options to sign out individual
 * devices or all other devices at once.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { cn } from '../../../lib/utils';

interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  platform: string;
}

interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  isActive: boolean;
  isCurrent?: boolean;
}

interface SessionsResponse {
  sessions: UserSession[];
  currentSessionId: string;
  totalSessions: number;
}

interface SecurityContentProps {
  onClose: () => void;
}

/**
 * Get a human-readable relative time string
 */
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Get icon name based on device type
 */
function getDeviceIcon(deviceType: string): 'Monitor' | 'Smartphone' | 'Tablet' {
  switch (deviceType) {
    case 'mobile':
      return 'Smartphone';
    case 'tablet':
      return 'Tablet';
    default:
      return 'Monitor';
  }
}

/**
 * Session card component
 */
function SessionCard({
  session,
  onRevoke,
  isRevoking
}: {
  session: UserSession;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}) {
  const deviceIcon = getDeviceIcon(session.deviceInfo.deviceType);
  const deviceDescription = `${session.deviceInfo.browser} on ${session.deviceInfo.os}`;

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border transition-colors",
        session.isCurrent
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Device icon */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          session.isCurrent
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}>
          <Icon name={deviceIcon} size={20} />
        </div>

        {/* Device info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {deviceDescription}
            </span>
            {session.isCurrent && (
              <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                This device
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Icon name="Clock" size={12} />
              <span>Last active: {getRelativeTime(session.lastActiveAt)}</span>
            </div>
            {session.createdAt && (
              <div className="flex items-center gap-1.5">
                <Icon name="LogIn" size={12} />
                <span>Signed in: {getRelativeTime(session.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Revoke button (not shown for current session) */}
        {!session.isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(session.id)}
            disabled={isRevoking}
            className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isRevoking ? (
              <Icon name="Loader" size={16} className="animate-spin" />
            ) : (
              <Icon name="LogOut" size={16} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SecurityContent({ onClose }: SecurityContentProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/sessions');

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const data: SessionsResponse = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user, fetchSessions]);

  // Revoke a specific session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);

      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to sign out device');
      }

      // Remove the session from the list
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out device');
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllOthers = async () => {
    try {
      setIsRevokingAll(true);

      const response = await fetch('/api/auth/sessions?revokeAll=true', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to sign out other devices');
      }

      // Keep only the current session
      setSessions(prev => prev.filter(s => s.isCurrent));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out other devices');
    } finally {
      setIsRevokingAll(false);
    }
  };

  if (!user) {
    return null;
  }

  const otherSessionsCount = sessions.filter(s => !s.isCurrent).length;

  return (
    <div className="px-4 pb-6">
      <div className="space-y-6">
        {/* Header description */}
        <p className="text-sm text-muted-foreground">
          Manage your active sessions across devices. You can sign out of individual devices
          or all other devices at once.
        </p>

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <Icon name="AlertCircle" size={16} />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSessions}
              className="mt-2 text-destructive"
            >
              Try again
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-border bg-card animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sessions list */}
        {!isLoading && !error && (
          <>
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRevoke={handleRevokeSession}
                  isRevoking={revokingSessionId === session.id}
                />
              ))}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Monitor" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active sessions found</p>
                </div>
              )}
            </div>

            {/* Sign out all other devices button */}
            {otherSessionsCount > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleRevokeAllOthers}
                  disabled={isRevokingAll}
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  {isRevokingAll ? (
                    <>
                      <Icon name="Loader" size={16} className="mr-2 animate-spin" />
                      Signing out...
                    </>
                  ) : (
                    <>
                      <Icon name="LogOut" size={16} className="mr-2" />
                      Sign out of {otherSessionsCount} other device{otherSessionsCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
