'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { WritingIdeasManager } from '../../components/admin/WritingIdeasManager';
import { Button } from '../../components/ui/button';

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
          router.push('/');
          return;
        }

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
          <Icon name="Loader" size={32} className="mx-auto mb-4" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.24))]">
      <WritingIdeasManager />
    </div>
  );
}
