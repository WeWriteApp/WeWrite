'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, FileText } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatDistanceToNow } from 'date-fns';

/**
 * RecentPagesCreatedCard Component
 * 
 * Displays a list of recently created pages
 */
export default function RecentPagesCreatedCard() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch recent pages
  const fetchRecentPages = async () => {
    try {
      setLoading(true);
      setError(null);

      const pagesRef = collection(db, 'pages');
      const pagesQuery = query(
        pagesRef,
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(pagesQuery);
      
      if (snapshot.empty) {
        setPages([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to pages array
      const pagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      setPages(pagesData);
    } catch (err) {
      console.error('Error fetching recent pages:', err);
      setError('Failed to load recent pages');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRecentPages();
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
          <FileText className="h-5 w-5" />
          Recent Pages Created
        </CardTitle>
        <CardDescription>
          Pages recently created by users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button
            onClick={fetchRecentPages}
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
        ) : pages.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            No recent pages
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map(page => (
              <div key={page.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <a 
                    href={`/${page.id}`} 
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {page.title || 'Untitled'}
                  </a>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span className="truncate">
                      {page.userId ? (
                        <a href={`/u/${page.username || page.userId}`} className="hover:underline">
                          {page.username || page.userId.substring(0, 8)}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{formatTimeAgo(page.createdAt)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {page.isPublic ? 'Public' : 'Private'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
