"use client";

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '../../providers/AuthProvider';
import { isAdmin } from '../../utils/feature-flags';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { ArrowLeft, Shield, Database, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { setupFeatureManagement } from '../../scripts/setup-feature-management';
import { useToast } from '../../components/ui/use-toast';

export default function SetupFeaturesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useContext(AuthContext);
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/setup-features');
    }
  }, [user, authLoading, router]);
  
  const runSetup = async () => {
    setIsRunning(true);
    try {
      const result = await setupFeatureManagement();
      
      if (result.success) {
        toast({
          title: 'Setup Complete',
          description: 'Feature management database has been set up successfully.',
          variant: 'default'
        });
        setIsComplete(true);
      } else {
        toast({
          title: 'Setup Failed',
          description: result.error?.message || 'An unknown error occurred',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error running setup:', error);
      toast({
        title: 'Setup Failed',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  if (authLoading || (user && !isAdmin(user.email))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/tools" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
      </div>
      
      <Card className="rounded-2xl border-theme-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Feature Management Setup
          </CardTitle>
          <CardDescription>
            Set up the database structure for enhanced feature management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-xl">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Database className="h-4 w-4 mr-2" />
              What This Will Do
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 ml-6 list-disc">
              <li>Create a <code>featureMetadata</code> document with creation dates and descriptions</li>
              <li>Ensure all feature flags have proper metadata</li>
              <li>Set up the database structure for user-specific feature overrides</li>
              <li>Set up the database structure for feature history tracking</li>
            </ul>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This is a one-time setup process. You only need to run this once to initialize the database structure.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={runSetup} 
            disabled={isRunning || isComplete}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Setting Up...
              </>
            ) : isComplete ? (
              'Setup Complete'
            ) : (
              'Run Setup'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      {isComplete && (
        <div className="mt-6 text-center">
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin/tools')}
          >
            Return to Admin Panel
          </Button>
        </div>
      )}
    </div>
  );
}
