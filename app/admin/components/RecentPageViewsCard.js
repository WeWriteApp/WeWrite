'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, Eye } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatDistanceToNow } from 'date-fns';

/**
 * RecentPageViewsCard Component
 *
 * Displays a list of recently viewed pages
 */
export default function RecentPageViewsCard() {
  const [pageViews, setPageViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch recent page views
  const fetchRecentPageViews = async () => {
    try {
      setLoading(true);
      setError(null);

      const pageViewsRef = collection(db, 'pageViews');
      const pageViewsQuery = query(
        pageViewsRef,
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(pageViewsQuery);

      if (snapshot.empty) {
        setPageViews([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to page views array
      const pageViewsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      setPageViews(pageViewsData);
    } catch (err) {
      console.error('Error fetching recent page views:', err);
      setError('Failed to load recent page views');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRecentPageViews();
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
          <Eye className="h-5 w-5" />
          Recent Page Views
        </CardTitle>
        <CardDescription>
          Pages recently viewed by users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button
            onClick={fetchRecentPageViews}
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
        ) : pageViews.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            No recent page views
          </div>
        ) : (
          <div className="space-y-2">
            {pageViews.map(view => (
              <div key={view.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <a
                    href={`/${view.pageId}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {view.pageTitle || view.pageId}
                  </a>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span className="truncate">
                      {view.userId ? (
                        <a href={`/user/${view.username || view.userId}`} className="hover:underline">
                          {view.username || view.userId.substring(0, 8)}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{formatTimeAgo(view.timestamp)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {view.deviceType || 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
