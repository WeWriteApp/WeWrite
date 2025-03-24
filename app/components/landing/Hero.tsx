"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { motion } from 'framer-motion';

export const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-background/95 py-20">
      {/* No background elements */}
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Write, share, earn.
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-muted-foreground mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              WeWrite is a social wiki where every page is a fundraiser. Write a hundred pages, you've just written a hundred Kickstarters.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Button size="default" variant="outline" asChild>
                <Link href="/auth/login">
                  Sign In
                </Link>
              </Button>
              <Button size="default" className="bg-blue-600 hover:bg-blue-700 text-white px-4" asChild>
                <Link href="/auth/register">
                  Create Account
                </Link>
              </Button>
            </motion.div>
          </div>
          
          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
          >
            <div className="relative w-full max-w-md mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 rounded-lg z-10"></div>
              <Image 
                src="/images/hero-image.png"
                alt="WeWrite App Interface"
                width={600}
                height={600}
                className="relative z-0 rounded-lg shadow-xl"
                priority
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};