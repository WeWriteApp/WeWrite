"use client";

import React from 'react';
import { X, Link } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Modal that appears when users try to use link functionality but don't have access
 */
const DisabledLinkModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X size={20} className="text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-full bg-muted">
            <Link size={24} className="text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Link Functionality Coming Soon</h3>
            <p className="text-muted-foreground text-sm">
              The ability to insert links between pages is currently in development. 
              This feature will be available to all users soon.
            </p>
          </div>

          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisabledLinkModal;
