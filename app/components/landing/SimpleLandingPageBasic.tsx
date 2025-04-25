"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';

const SimpleLandingPageBasic = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-4 bg-background">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary">
                WeWrite
              </Link>
              <nav className="hidden md:flex ml-10 space-x-8">
                <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
                <Link href="#coming-soon" className="text-muted-foreground hover:text-foreground transition-colors">
                  Coming Soon
                </Link>
                <Link href="#supporters" className="text-muted-foreground hover:text-foreground transition-colors">
                  Supporters
                </Link>
                <Link href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                  Write, share, earn.
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground mb-8">
                  WeWrite is a social wiki where every page is a fundraiser. Write a hundred pages, you've just written a hundred Kickstarters.
                </p>
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                    <Link href="/auth/register">Create Account</Link>
                  </Button>
                </div>
              </div>

              <div className="flex-1">
                <div className="relative w-full max-w-lg mx-auto">
                  <Image
                    src="/images/landing/hero-image.png"
                    alt="WeWrite App Interface"
                    width={700}
                    height={700}
                    className="rounded-lg shadow-2xl"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
                About WeWrite
              </h2>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p>
                  WeWrite is a platform that combines the collaborative nature of wikis with the monetization potential of crowdfunding. Our mission is to empower writers, creators, and knowledge-sharers to build sustainable income streams while creating valuable content.
                </p>
                <p>
                  Founded in 2023, WeWrite was born from the belief that content creators deserve to be compensated fairly for their work. We've built a platform that makes it easy to create, share, and monetize your knowledge and creativity.
                </p>
                <p>
                  Whether you're a writer, educator, expert, or enthusiast, WeWrite provides the tools you need to build an audience, share your expertise, and earn from your content.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="text-2xl font-bold text-primary mb-4 block">
                WeWrite
              </Link>
              <p className="text-muted-foreground mb-4 max-w-md">
                A social wiki where every page is a fundraiser. Create, share, and earn from your content.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#coming-soon" className="text-muted-foreground hover:text-foreground transition-colors">
                    Coming Soon
                  </Link>
                </li>
                <li>
                  <Link href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Account</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/auth/login" className="text-muted-foreground hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/auth/register" className="text-muted-foreground hover:text-foreground transition-colors">
                    Create Account
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} WeWrite. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SimpleLandingPageBasic;
