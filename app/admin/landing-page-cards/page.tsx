"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LandingPageCardsManager } from '../../components/admin/LandingPageCardsManager';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LandingPageCardsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isLoading) return;
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      try {
        // Check if user is admin
        const response = await fetch('/api/admin/check-permissions');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.isAdmin) {
            setIsAdmin(true);
          } else {
            router.push('/');
            return;
          }
        } else {
          router.push('/');
          return;
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.push('/');
        return;
      }
      
      setAuthChecked(true);
    };

    checkAdminStatus();
  }, [user, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show error if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
          <Link href="/" className="text-primary hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/admin" 
            className="inline-flex items-center text-primary hover:text-primary/80 transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Link>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Landing Page Cards Manager</h1>
            <p className="text-muted-foreground text-lg">
              Configure which pages appear on the logged-out landing page and manage their display order.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>Add cards:</strong> Click "Add New Card" and search for pages to add</li>
            <li>• <strong>Rearrange:</strong> Use the up/down arrows to change display order</li>
            <li>• <strong>Edit:</strong> Click the edit button to modify card settings</li>
            <li>• <strong>Delete:</strong> Click the trash button to remove cards</li>
            <li>• <strong>Save:</strong> Don't forget to save your changes!</li>
          </ul>
        </div>

        {/* Landing Page Cards Manager */}
        <LandingPageCardsManager />

        {/* Preview Link */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Preview Changes</h3>
          <p className="text-sm text-muted-foreground mb-3">
            View how your changes will appear on the landing page:
          </p>
          <Link 
            href="/" 
            target="_blank"
            className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
          >
            Open Landing Page in New Tab
            <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
