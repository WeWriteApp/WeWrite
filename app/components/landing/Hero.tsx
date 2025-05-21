"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { motion } from 'framer-motion';
import { useState, useCallback, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const HERO_IMAGES = [
  '/images/landing/LP-01.png',
  '/images/landing/LP-02.png',
  '/images/landing/LP-03.png',
  '/images/landing/LP-04.png',
  '/images/landing/LP-05.png',
];

export const Hero = () => {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + HERO_IMAGES.length) % HERO_IMAGES.length), []);
  const next = useCallback(() => setCurrent((c) => (c + 1) % HERO_IMAGES.length), []);
  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, prev, next]);

  // Focus trap for accessibility
  useEffect(() => {
    if (lightboxOpen && lightboxRef.current) {
      lightboxRef.current.focus();
    }
  }, [lightboxOpen]);

  return (
    <section className="relative bg-gradient-to-b from-background to-background/95 py-20">
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

          {/* Carousel */}
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
          >
            <div className="relative w-full max-w-md mx-auto h-auto group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 rounded-lg z-10 pointer-events-none"></div>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1 shadow transition hidden group-hover:block"
                onClick={prev}
                aria-label="Previous image"
                type="button"
              >
                <ChevronLeft className="h-6 w-6 text-gray-700" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-1 shadow transition hidden group-hover:block"
                onClick={next}
                aria-label="Next image"
                type="button"
              >
                <ChevronRight className="h-6 w-6 text-gray-700" />
              </button>
              <Image
                src={HERO_IMAGES[current]}
                alt={`WeWrite App Preview ${current + 1}`}
                width={600}
                height={600}
                className="relative z-0 rounded-lg shadow-xl cursor-pointer transition-transform duration-300 hover:scale-105"
                priority
                onClick={openLightbox}
              />
              {/* Filmstrip */}
              <div className="flex justify-center gap-2 mt-4">
                {HERO_IMAGES.map((img, idx) => (
                  <button
                    key={img}
                    className={`rounded border-2 ${idx === current ? 'border-blue-500' : 'border-transparent'} focus:outline-none`}
                    style={{ padding: 0 }}
                    onClick={() => setCurrent(idx)}
                    aria-label={`Show image ${idx + 1}`}
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      width={60}
                      height={60}
                      className={`rounded object-cover ${idx === current ? 'ring-2 ring-blue-500' : ''}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <motion.div
          ref={lightboxRef}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
        >
          <button
            className="absolute top-6 right-8 z-50 bg-white/80 hover:bg-white rounded-full p-2 shadow"
            onClick={closeLightbox}
            aria-label="Close lightbox"
            type="button"
          >
            <X className="h-7 w-7 text-gray-700" />
          </button>
          {/* Navigation arrows removed from lightbox view as requested */}
          <div className="flex-1 flex items-center justify-center w-full max-h-[80vh]">
            <Image
              src={HERO_IMAGES[current]}
              alt={`WeWrite App Preview ${current + 1}`}
              width={900}
              height={900}
              className="rounded-lg shadow-2xl max-h-[80vh] object-contain"
              priority
            />
          </div>
          {/* Filmstrip in lightbox */}
          <div className="flex justify-center gap-3 mt-8 mb-8">
            {HERO_IMAGES.map((img, idx) => (
              <button
                key={img}
                className={`rounded border-2 ${idx === current ? 'border-blue-500' : 'border-transparent'} focus:outline-none`}
                style={{ padding: 0 }}
                onClick={() => setCurrent(idx)}
                aria-label={`Show image ${idx + 1}`}
              >
                <Image
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  width={80}
                  height={80}
                  className={`rounded object-cover ${idx === current ? 'ring-2 ring-blue-500' : ''}`}
                />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  );
};