"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { isAdmin } from '../../utils/isAdmin';
// REMOVED: Direct Firebase imports - now using API endpoints

interface AdminSectionProps {
  userId: string;
  userEmail: string | null;
}

export default function AdminSection({ userId, userEmail }: AdminSectionProps) {
  const router = useRouter();
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = () => {
      setIsLoading(true);

      // Use centralized admin check
      setIsUserAdmin(isAdmin(userEmail));
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [userEmail]);
  
  if (isLoading) {
    return null;
  }
  
  if (!isUserAdmin) {
    return null;
  }
  
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Shield" size={20} />
            Admin
          </CardTitle>
          <CardDescription>Access administrative tools and settings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Manage feature flags, admin users, and other administrative settings.
          </p>
          <Button
            onClick={() => router.push('/admin')}
            className="w-full"
          >
            Go to Admin Panel
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}