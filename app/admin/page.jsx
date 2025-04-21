'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/app/utils/currentUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  
  // Check if user is authorized to access admin page
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          router.push('/login');
          return;
        }
        
        setUser(currentUser);
        
        // Check if user is an admin (replace with your admin check logic)
        // For now, we'll use a hardcoded list of admin emails
        const adminEmails = [
          'admin@wewrite.com',
          'jamie@wewrite.com',
          // Add other admin emails here
        ];
        
        if (adminEmails.includes(currentUser.email)) {
          setAuthorized(true);
        } else {
          router.push('/');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error checking auth:', error);
        setLoading(false);
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);
  
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p>Checking authorization</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!authorized) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p>You do not have permission to access this page.</p>
            <Button className="mt-4" onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and monitor your WeWrite application
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminCard
            title="Database Management"
            description="Monitor and optimize database usage"
            icon="📊"
            onClick={() => router.push('/admin/database')}
          />
          
          <AdminCard
            title="User Management"
            description="Manage users and permissions"
            icon="👥"
            onClick={() => router.push('/admin/users')}
          />
          
          <AdminCard
            title="Content Moderation"
            description="Review and moderate content"
            icon="📝"
            onClick={() => router.push('/admin/moderation')}
          />
          
          <AdminCard
            title="System Settings"
            description="Configure system settings"
            icon="⚙️"
            onClick={() => router.push('/admin/settings')}
          />
          
          <AdminCard
            title="Analytics"
            description="View usage analytics and reports"
            icon="📈"
            onClick={() => router.push('/admin/analytics')}
          />
          
          <AdminCard
            title="Subscription Management"
            description="Manage subscription plans and payments"
            icon="💰"
            onClick={() => router.push('/admin/subscriptions')}
          />
        </div>
      </div>
    </div>
  );
}

function AdminCard({ title, description, icon, onClick }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onClick} className="w-full">
          Manage
        </Button>
      </CardFooter>
    </Card>
  );
}
