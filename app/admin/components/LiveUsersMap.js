'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, Globe } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * LiveUsersMap Component
 * 
 * Displays a world map with dots representing active users
 */
export default function LiveUsersMap() {
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch active users from Firebase
  const fetchActiveUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get sessions active in the last 15 minutes
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
      
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(
        sessionsRef,
        where('lastActive', '>=', Timestamp.fromDate(fifteenMinutesAgo)),
        orderBy('lastActive', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(sessionsQuery);
      
      if (snapshot.empty) {
        setActiveUsers([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to users array with location data
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastActive: doc.data().lastActive?.toDate() || new Date()
      }));

      setActiveUsers(usersData);
    } catch (err) {
      console.error('Error fetching active users:', err);
      setError('Failed to load active users');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchActiveUsers();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchActiveUsers, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Format time ago
  const formatTimeAgo = (date) => {
    if (!date) return 'Unknown';
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Live Users Map
        </CardTitle>
        <CardDescription>
          Users currently active on the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button
            onClick={fetchActiveUsers}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            {loading ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64 text-destructive">
            {error}
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="flex justify-center items-center h-64 text-muted-foreground">
            No active users found
          </div>
        ) : (
          <div className="space-y-4">
            {/* World Map Visualization */}
            <div className="relative h-64 border rounded-md bg-muted/30 overflow-hidden">
              {/* Simple world map background */}
              <div className="absolute inset-0 opacity-20 bg-[url('/world-map-outline.svg')] bg-center bg-no-repeat bg-contain"></div>
              
              {/* User dots */}
              {activeUsers.map(user => {
                // Generate random position if no location data
                const lat = user.location?.latitude || Math.random() * 180 - 90;
                const lng = user.location?.longitude || Math.random() * 360 - 180;
                
                // Convert lat/lng to x/y coordinates (simple equirectangular projection)
                const x = ((lng + 180) / 360) * 100; // 0-100%
                const y = ((90 - lat) / 180) * 100;  // 0-100%
                
                return (
                  <div
                    key={user.id}
                    className="absolute w-2 h-2 rounded-full bg-primary animate-pulse"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    title={`${user.username || 'Anonymous'} - ${formatTimeAgo(user.lastActive)}`}
                  />
                );
              })}
            </div>
            
            {/* Active Users List */}
            <div className="overflow-y-auto max-h-[200px] border rounded-md">
              <table className="w-full">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">User</th>
                    <th className="text-left p-2 font-medium">Last Active</th>
                    <th className="text-left p-2 font-medium">Location</th>
                    <th className="text-left p-2 font-medium">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map(user => (
                    <tr key={user.id} className="border-b border-border/40 hover:bg-muted/50">
                      <td className="p-2 text-sm">
                        {user.userId ? (
                          <a href={`/u/${user.username || user.userId}`} className="hover:underline">
                            {user.username || user.userId.substring(0, 8)}
                          </a>
                        ) : (
                          'Anonymous'
                        )}
                      </td>
                      <td className="p-2 text-sm">{formatTimeAgo(user.lastActive)}</td>
                      <td className="p-2 text-sm">
                        {user.location?.country || user.location?.city || 'Unknown'}
                      </td>
                      <td className="p-2 text-sm">
                        {user.device?.type || 'Unknown'} {user.device?.browser || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
