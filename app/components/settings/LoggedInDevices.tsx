'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  Shield, 
  AlertTriangle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location?: string;
}

interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  isCurrentSession: boolean;
}

export default function LoggedInDevices() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/sessions', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load logged-in devices');
    } finally {
      setLoading(false);
    }
  };

  // Revoke a session
  const revokeSession = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      setError(null);
      
      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }
      
      // Remove the session from the list
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Show success message briefly
      const successMessage = 'Device logged out successfully';
      setError(null);
      
      // If it was the current session, the user will be logged out
      const revokedSession = sessions.find(s => s.id === sessionId);
      if (revokedSession?.isCurrentSession) {
        // Redirect to login after a brief delay
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 2000);
      }
      
    } catch (err) {
      console.error('Error revoking session:', err);
      setError('Failed to log out device');
    } finally {
      setRevoking(null);
    }
  };

  // Get device icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  // Format last active time
  const formatLastActive = (lastActiveAt: string) => {
    const date = new Date(lastActiveAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  // Load sessions on mount
  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Logged in devices</h3>
          <p className="text-sm text-muted-foreground">
            Manage devices that are currently logged into your account
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSessions}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="w-32 h-4 bg-muted rounded"></div>
                    <div className="w-24 h-3 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="w-20 h-8 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions list */}
      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                session.isCurrentSession
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Device icon */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  session.isCurrentSession ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {getDeviceIcon(session.deviceInfo.deviceType)}
                </div>

                {/* Device info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {session.deviceInfo.browser} on {session.deviceInfo.os}
                    </span>
                    {session.isCurrentSession && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        <Shield className="h-3 w-3" />
                        Current device
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatLastActive(session.lastActiveAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {session.ipAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!session.isCurrentSession && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {revoking === session.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {revoking === session.id ? 'Logging out...' : 'Log out'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">No active sessions</h4>
          <p className="text-sm text-muted-foreground">
            You don't have any active sessions on other devices.
          </p>
        </div>
      )}

      {/* Security note */}
      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-medium text-foreground">Security tip</h4>
            <p className="text-sm text-muted-foreground">
              If you see any devices you don't recognize, log them out immediately and consider changing your password.
              Sessions automatically expire after 30 days of inactivity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
