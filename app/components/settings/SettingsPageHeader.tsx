'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { ChevronLeft } from 'lucide-react';

interface SettingsPageHeaderProps {
  title: string;
  description?: string;
  backPath?: string;
}

export function SettingsPageHeader({ 
  title, 
  description, 
  backPath = '/settings' 
}: SettingsPageHeaderProps) {
  const router = useRouter();

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(backPath)}
            className="mr-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold select-none">{title}</h1>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block mb-8 px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground select-none">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 select-none">{description}</p>
        )}
      </div>
    </>
  );
}
