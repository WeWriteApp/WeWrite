"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Feature {
  title: string;
  description: string;
  status: 'done' | 'in-progress' | 'coming-soon';
  icon?: React.ReactNode;
}

export const FeatureCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const features: Feature[] = [
    {
      title: "Every Page is a Fundraiser",
      description: "On every page, there's a little Pledge bar floating at the bottom. Users set their Budget (which is just their subscription) and donate some amount of their budget to their favorite pages.",
      status: "in-progress"
    },
    {
      title: "Recurring donations",
      description: "Support your favorite creators with monthly donations that help them continue creating great content.",
      status: "coming-soon"
    },
    {
      title: "No ads",
      description: "Since each page on WeWrite is a fundraiser, we won't need to sell ad space to companies, we'll be able to pay for our platform costs with fees.",
      status: "done"
    },
    {
      title: "Collaborative pages",
      description: "Work together with others on shared documents with real-time collaboration features.",
      status: "coming-soon"
    },
    {
      title: "Map view",
      description: "Visualize your content and connections in an interactive map interface.",
      status: "coming-soon"
    },
    {
      title: "Calendar view",
      description: "Organize and view your content chronologically with our calendar interface.",
      status: "coming-soon"
    },
    {
      title: "Version history",
      description: "Track changes and revert to previous versions of your content when needed.",
      status: "done"
    },
    {
      title: "Beautiful reading experience",
      description: "Enjoy a clean, distraction-free reading experience optimized for all devices.",
      status: "in-progress"
    },
    {
      title: "Line modes",
      description: "Choose between different line display modes to customize your reading experience.",
      status: "done"
    }
  ];

  const getStatusBadge = (status: Feature['status']) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-green-500 hover:bg-green-600">Done</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Getting There</Badge>;
      case 'coming-soon':
        return <Badge className="bg-amber-500 hover:bg-amber-600">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  const nextSlide = () => {
    setActiveIndex((prevIndex) =>
      prevIndex === features.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setActiveIndex((prevIndex) =>
      prevIndex === 0 ? features.length - 1 : prevIndex - 1
    );
  };

  const goToSlide = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Features</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover what makes WeWrite special
          </p>
        </motion.div>

        <div className="relative max-w-3xl mx-auto">
          {/* Carousel container */}
          <div className="overflow-hidden rounded-xl">
            <div
              className="flex transition-transform duration-500 ease-in-out touch-pan-x"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              onTouchStart={(e) => {
                const touchStartX = e.touches[0].clientX;
                const touchMoveHandler = (e: TouchEvent) => {
                  const touchCurrentX = e.touches[0].clientX;
                  const diff = touchStartX - touchCurrentX;
                  if (Math.abs(diff) > 50) { // Threshold to trigger slide
                    if (diff > 0) {
                      // Swipe left, go to next slide
                      nextSlide();
                    } else {
                      // Swipe right, go to previous slide
                      prevSlide();
                    }
                    document.removeEventListener('touchmove', touchMoveHandler);
                  }
                };
                document.addEventListener('touchmove', touchMoveHandler, { passive: true });
                document.addEventListener('touchend', () => {
                  document.removeEventListener('touchmove', touchMoveHandler);
                }, { once: true });
              }}
            >
              {features.map((feature, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <Card className="h-full border border-border dark:border-border overflow-hidden">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-2xl">{feature.title}</CardTitle>
                        {getStatusBadge(feature.status)}
                      </div>
                      <CardDescription className="text-lg mt-2">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      {(feature.status === 'coming-soon' || feature.status === 'in-progress') && (
                        <Button variant="outline" asChild>
                          <a
                            href="https://opencollective.com/wewrite-app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm"
                          >
                            Support development on OpenCollective
                          </a>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-background border border-border dark:border-border rounded-full p-2 shadow-md hover:bg-muted transition-colors z-10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-background border border-border dark:border-border rounded-full p-2 shadow-md hover:bg-muted transition-colors z-10"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots navigation */}
          <div className="flex justify-center mt-6 space-x-2">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  index === activeIndex
                    ? 'bg-primary'
                    : 'bg-muted hover:bg-primary/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
