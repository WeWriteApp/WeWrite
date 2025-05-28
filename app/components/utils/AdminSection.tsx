"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../firebase/database";

interface AdminSectionProps {
  userId: string;
  userEmail: string | null;
}

export default function AdminSection({ userId, userEmail }: AdminSectionProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is in the default admin list
        if (userEmail === 'jamiegray2234@gmail.com') {
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }
        
        // Check if user is in the admin users list in Firestore
        const adminUsersRef = doc(db, 'config', 'adminUsers');
        const adminUsersDoc = await getDoc(adminUsersRef);
        
        if (adminUsersDoc.exists()) {
          const adminUserIds = adminUsersDoc.data().userIds || [];
          setIsAdmin(adminUserIds.includes(userId));
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAdminStatus();
  }, [userId, userEmail]);
  
  if (isLoading) {
    return null;
  }
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
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
