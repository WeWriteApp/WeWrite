"use client";

import React from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="bg-primary/10 p-6 rounded-full mb-6">
        <WifiOff className="h-12 w-12 text-primary" />
      </div>
      
      <h1 className="text-3xl font-bold mb-4">You're offline</h1>
      
      <p className="text-muted-foreground mb-8 max-w-md">
        It looks like you're not connected to the internet. 
        Some features may be unavailable until you reconnect.
      </p>
      
      <div className="space-y-4">
        <Button 
          onClick={() => router.push('/')}
          className="w-full sm:w-auto"
        >
          Try going to home page
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => window.location.reload()}
          className="w-full sm:w-auto"
        >
          Retry connection
        </Button>
      </div>
    </div>
  );
}
