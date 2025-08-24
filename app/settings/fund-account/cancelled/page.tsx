'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { CheckCircle, Home, Settings } from 'lucide-react';
import Link from 'next/link';

export default function CancellationSuccessPage() {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  const handleManageAccount = () => {
    router.push('/settings/fund-account');
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-md mx-auto">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
              Successfully Cancelled!
            </h2>
            
            <p className="text-green-700 dark:text-green-300 mb-6">
              Hope to welcome you back soon!
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={handleGoHome} 
                className="w-full" 
                size="lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
              
              <Button
                onClick={handleManageAccount}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Account
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Remember:</strong> You can still allocate your current month's funds to pages until the end of the month. You can reactivate your subscription anytime!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
