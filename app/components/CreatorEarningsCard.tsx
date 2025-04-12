import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useRouter } from 'next/navigation';
import { getEstimatedEarnings } from '../services/stripeConnectService';

interface CreatorEarningsCardProps {
  creatorId: string;
  isCreator: boolean;
}

const CreatorEarningsCard: React.FC<CreatorEarningsCardProps> = ({ 
  creatorId,
  isCreator
}) => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!creatorId || !isCreator) return;

    const loadEarnings = async () => {
      try {
        const data = await getEstimatedEarnings(creatorId);
        setEarnings(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load earnings data');
        console.error('Error loading earnings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEarnings();
  }, [creatorId, isCreator]);

  if (!isCreator) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Creator Earnings</CardTitle>
        <CardDescription>Your estimated earnings from donations</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 mr-3">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Earnings</p>
                  <p className="text-xl font-bold">${earnings?.estimated.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <Users className="h-4 w-4 text-muted-foreground mr-1" />
                  <p className="text-xs text-muted-foreground">Donors</p>
                </div>
                <p className="text-lg font-semibold">{earnings?.donorCount || 0}</p>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground mr-1" />
                  <p className="text-xs text-muted-foreground">Pages</p>
                </div>
                <p className="text-lg font-semibold">{earnings?.pageCount || 0}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => router.push('/account/payouts')}
          className="w-full"
          variant="outline"
        >
          View Earnings Dashboard
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CreatorEarningsCard;
