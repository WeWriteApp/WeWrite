'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { WritingIdeasManager } from '../../components/admin/WritingIdeasManager';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function WritingIdeasPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check admin permissions
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      try {
        // Check if user has admin permissions by calling the API
        const response = await fetch('/api/admin/check-permissions');
        const result = await response.json();

        if (!result.isAdmin) {
          console.log('User is not admin, redirecting to home');
          router.push('/');
          return;
        }

        console.log('User is admin, allowing access');
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.push('/');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading, router]);

  if (authLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Writing Ideas Management</h1>
              <p className="text-muted-foreground">
                Manage writing ideas that appear when users create new pages
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <WritingIdeasManager />
      </div>
    </div>
  );
}
