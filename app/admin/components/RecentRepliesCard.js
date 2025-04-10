'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, MessageSquare } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatDistanceToNow } from 'date-fns';

/**
 * RecentRepliesCard Component
 * 
 * Displays a list of recently created replies
 */
export default function RecentRepliesCard() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch recent replies
  const fetchRecentReplies = async () => {
    try {
      setLoading(true);
      setError(null);

      const repliesRef = collection(db, 'replies');
      const repliesQuery = query(
        repliesRef,
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(repliesQuery);
      
      if (snapshot.empty) {
        setReplies([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to replies array
      const repliesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      setReplies(repliesData);
    } catch (err) {
      console.error('Error fetching recent replies:', err);
      setError('Failed to load recent replies');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRecentReplies();
  }, []);

  // Format time ago
  const formatTimeAgo = (date) => {
    if (!date) return 'Unknown';
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Recent Replies
        </CardTitle>
        <CardDescription>
          Replies recently created by users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button
            onClick={fetchRecentReplies}
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
          <div className="flex justify-center items-center h-40">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-40 text-destructive">
            {error}
          </div>
        ) : replies.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            No recent replies
          </div>
        ) : (
          <div className="space-y-2">
            {replies.map(reply => (
              <div key={reply.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <a 
                    href={`/${reply.pageId}`} 
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {reply.pageTitle || 'Reply to page'}
                  </a>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span className="truncate">
                      {reply.userId ? (
                        <a href={`/u/${reply.username || reply.userId}`} className="hover:underline">
                          {reply.username || reply.userId.substring(0, 8)}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{formatTimeAgo(reply.createdAt)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {reply.isPublic ? 'Public' : 'Private'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
