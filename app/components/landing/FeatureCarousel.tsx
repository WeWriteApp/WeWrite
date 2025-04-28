"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Feature {
  title: string;
  description: string;
  status: 'done' | 'in-progress' | 'coming-soon';
  icon?: React.ReactNode;
  image?: string;
}

export const FeatureCarousel = () => {
  const [activeCategory, setActiveCategory] = useState<'built' | 'coming-soon'>('built');
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const allFeatures: Feature[] = [
    {
      title: "Every Page is a Fundraiser",
      description: "On every page, there's a little Pledge bar floating at the bottom. Users set their Budget (which is just their subscription) and donate some amount of their budget to their favorite pages.",
      status: "in-progress",
      image: "/images/feature-fundraiser.png"
    },
    {
      title: "Recurring donations",
      description: "Support your favorite creators with monthly donations that help them continue creating great content.",
      status: "coming-soon",
      image: "/images/feature-donations.png"
    },
    {
      title: "No ads",
      description: "Since each page on WeWrite is a fundraiser, we won't need to sell ad space to companies, we'll be able to pay for our platform costs with fees.",
      status: "done",
      image: "/images/feature-no-ads.png"
    },
    {
      title: "Collaborative pages",
      description: "Work together with others on shared documents with real-time collaboration features.",
      status: "coming-soon",
      image: "/images/feature-collaboration.png"
    },
    {
      title: "Map view",
      description: "Visualize your content and connections in an interactive map interface.",
      status: "coming-soon",
      image: "/images/feature-map-view.png"
    },
    {
      title: "Calendar view",
      description: "Organize and view your content chronologically with our calendar interface.",
      status: "coming-soon",
      image: "/images/feature-calendar.png"
    },
    {
      title: "Version history",
      description: "Track changes and revert to previous versions of your content when needed.",
      status: "done",
      image: "/images/feature-version-history.png"
    },
    {
      title: "Beautiful reading experience",
      description: "Enjoy a clean, distraction-free reading experience optimized for all devices.",
      status: "in-progress",
      image: "/images/feature-reading.png"
    },
    {
      title: "Line modes",
      description: "Choose between different line display modes to customize your reading experience.",
      status: "done",
      image: "/images/feature-line-modes.png"
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

  // Filter features by status
  const builtFeatures = allFeatures.filter(feature =>
    feature.status === 'done' || feature.status === 'in-progress'
  );

  const comingSoonFeatures = allFeatures.filter(feature =>
    feature.status === 'coming-soon'
  );

  // Get the active features based on the selected category
  const features = activeCategory === 'built' ? builtFeatures : comingSoonFeatures;

  // Reset active index when changing categories
  useEffect(() => {
    setActiveIndex(0);
  }, [activeCategory]);

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

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setDirection(1);
      nextSlide();
    },
    onSwipedRight: () => {
      setDirection(-1);
      prevSlide();
    },
    trackMouse: true, // allow mouse drag
    trackTouch: true, // allow touch
    preventDefaultTouchmoveEvent: true,
  });

  // Animate on arrow click
  const handleNext = () => {
    setDirection(1);
    nextSlide();
  };
  const handlePrev = () => {
    setDirection(-1);
    prevSlide();
  };

  return (
    <div className="py-12 overflow-visible">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Features</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Discover what makes WeWrite special
          </p>

          {/* Category tabs */}
          <div className="flex justify-center gap-4 mb-8">
            <Button
              variant={activeCategory === 'built' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('built')}
              className="min-w-[120px]"
            >
              Built Features
            </Button>
            <Button
              variant={activeCategory === 'coming-soon' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('coming-soon')}
              className="min-w-[120px]"
            >
              Coming Soon
            </Button>
          </div>
        </motion.div>

        <div className="relative max-w-3xl mx-auto">
          {/* Carousel container */}
          <div className="overflow-visible rounded-xl touch-none">
            <div {...handlers}>
              <motion.div
                key={activeIndex}
                initial={{ x: direction * 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -300, opacity: 0 }}
                transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                className="flex transition-none"
              >
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="w-full flex-shrink-0"
                    style={{ display: index === activeIndex ? 'block' : 'none' }}
                  >
                    <Card className="h-full border border-border dark:border-border overflow-hidden">
                      {feature.image && (
                        <div className="relative w-full h-48 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 z-10"></div>
                          <Image
                            src={feature.image}
                            alt={feature.title}
                            width={600}
                            height={300}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
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
                              href="/subscription"
                              className="text-sm"
                            >
                              Become a Supporter
                            </a>
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-background border border-border dark:border-border rounded-full p-2 shadow-md hover:bg-muted transition-colors z-10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={handleNext}
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
