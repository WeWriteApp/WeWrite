'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, Activity } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * RawEventFeed Component
 *
 * Displays a real-time feed of system events from Firebase
 */
export default function RawEventFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventType, setEventType] = useState('all');
  const [maxEvents, setMaxEvents] = useState(50);

  // Fetch events from Firebase
  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create base query
      let eventsQuery;
      const eventsRef = collection(db, 'events');

      // Filter by event type if not 'all'
      if (eventType !== 'all') {
        eventsQuery = query(
          eventsRef,
          where('type', '==', eventType),
          orderBy('timestamp', 'desc'),
          limit(maxEvents)
        );
      } else {
        eventsQuery = query(
          eventsRef,
          orderBy('timestamp', 'desc'),
          limit(maxEvents)
        );
      }

      const snapshot = await getDocs(eventsQuery);

      if (snapshot.empty) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to events array
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      setEvents(eventsData);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [eventType]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // If today, show time only
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString();
    }

    // Otherwise show date and time
    return date.toLocaleString();
  };

  // Get event type color
  const getEventTypeColor = (type) => {
    const colors = {
      'page_view': 'text-blue-500',
      'page_created': 'text-green-500',
      'page_edited': 'text-yellow-500',
      'user_login': 'text-purple-500',
      'user_register': 'text-indigo-500',
      'reply_created': 'text-orange-500',
      'error': 'text-red-500'
    };

    return colors[type] || 'text-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Raw Event Feed
        </CardTitle>
        <CardDescription>
          Real-time feed of system events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Tabs value={eventType} onValueChange={setEventType}>
            <TabsList>
              <TabsTrigger value="all">All Events</TabsTrigger>
              <TabsTrigger value="page_view">Page Views</TabsTrigger>
              <TabsTrigger value="page_created">Pages Created</TabsTrigger>
              <TabsTrigger value="user_login">User Logins</TabsTrigger>
              <TabsTrigger value="error">Errors</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={fetchEvents}
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
        ) : events.length === 0 ? (
          <div className="flex justify-center items-center h-64 text-muted-foreground">
            No events found
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[400px] border rounded-md">
            <table className="w-full">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left p-2 font-medium">Time</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-left p-2 font-medium">User</th>
                  <th className="text-left p-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} className="border-b border-border/40 hover:bg-muted/50">
                    <td className="p-2 text-sm">{formatTimestamp(event.timestamp)}</td>
                    <td className={`p-2 text-sm ${getEventTypeColor(event.type)}`}>
                      {event.type || 'unknown'}
                    </td>
                    <td className="p-2 text-sm">
                      {event.userId ? (
                        <a href={`/user/${event.username || event.userId}`} className="hover:underline">
                          {event.username || event.userId.substring(0, 8)}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </td>
                    <td className="p-2 text-sm">
                      {event.pageId ? (
                        <a href={`/${event.pageId}`} className="hover:underline">
                          {event.pageTitle || event.pageId}
                        </a>
                      ) : (
                        event.details || event.message || '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
