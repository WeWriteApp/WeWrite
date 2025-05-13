"use client";

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Code } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AlwaysVisibleDebugger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg bg-red-500 hover:bg-red-600 text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Code className="h-6 w-6" />
      </Button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-16 right-0 bg-background border border-border rounded-lg shadow-lg p-4 w-64"
        >
          <h3 className="font-bold mb-2">Debug Panel</h3>
          <p className="text-sm mb-4">This is a test debug panel that should always be visible.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </motion.div>
      )}
    </div>
  );
}
