"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DonationsList from '../../components/DonationsList';

export default function DonationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    setLoading(false);
  }, [user, router]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Donations</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your monthly donations to pages and creators.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card shadow-sm rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Pages I Support</h2>
            <DonationsList />
          </div>
          
          <div className="bg-card shadow-sm rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Donation History</h2>
            <p className="text-muted-foreground">
              Your donation history will appear here once payments have been processed.
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">About Donations</h3>
            <p className="text-blue-700 dark:text-blue-400 text-sm">
              Your monthly subscription budget is allocated to pages at the end of each billing cycle.
              You can adjust your donations at any time before the end of your billing period.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
