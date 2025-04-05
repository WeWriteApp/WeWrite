"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { ChevronLeft } from 'lucide-react';

/**
 * PageHeader Component
 * 
 * A reusable header component for pages and page-related views like history.
 * 
 * @param {Object} props
 * @param {string} props.title - The title to display
 * @param {string} props.backUrl - URL to navigate to when back button is clicked
 * @param {string} props.backLabel - Label for the back button
 * @param {React.ReactNode} props.rightContent - Optional content to display on the right side
 * @param {string} props.className - Additional CSS classes
 */
export default function PageHeader({ 
  title, 
  backUrl, 
  backLabel = "Back", 
  rightContent,
  className = ""
}) {
  const router = useRouter();
  
  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };
  
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center">
        {backUrl !== undefined && (
          <Button variant="outline" size="lg" onClick={handleBack} className="mr-3">
            <ChevronLeft className="h-5 w-5 mr-2" />
            {backLabel}
          </Button>
        )}
        <h1 className="text-2xl font-bold truncate">
          {title}
        </h1>
      </div>
      
      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}
    </div>
  );
}
