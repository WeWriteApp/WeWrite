'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw, UserPlus } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatDistanceToNow } from 'date-fns';

/**
 * RecentAccountsCard Component
 *
 * Displays a list of recently created user accounts
 */
export default function RecentAccountsCard() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch recent accounts
  const fetchRecentAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(usersQuery);

      if (snapshot.empty) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      // Convert snapshot to accounts array
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      setAccounts(accountsData);
    } catch (err) {
      console.error('Error fetching recent accounts:', err);
      setError('Failed to load recent accounts');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRecentAccounts();
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
          <UserPlus className="h-5 w-5" />
          Recent Accounts
        </CardTitle>
        <CardDescription>
          User accounts recently created
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button
            onClick={fetchRecentAccounts}
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
        ) : accounts.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            No recent accounts
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <a
                    href={`/user/${account.username || account.id}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {account.username || account.email || account.id.substring(0, 8)}
                  </a>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>{account.email || 'No email'}</span>
                    <span className="mx-1">•</span>
                    <span>{formatTimeAgo(account.createdAt)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {account.provider || 'Email'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
