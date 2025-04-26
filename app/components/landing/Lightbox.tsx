"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeImage: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onChangeImage
}) => {
  const [loaded, setLoaded] = useState(false);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        onChangeImage((currentIndex - 1 + images.length) % images.length);
        break;
      case 'ArrowRight':
        onChangeImage((currentIndex + 1) % images.length);
        break;
      default:
        break;
    }
  }, [isOpen, onClose, onChangeImage, currentIndex, images.length]);

  // Add and remove event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Reset loaded state when image changes
  useEffect(() => {
    setLoaded(false);
  }, [currentIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-50 p-2 text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Main image container */}
          <motion.div
            className="relative w-full h-[calc(100vh-160px)] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Left arrow */}
            <button
              className="absolute left-4 z-40 p-2 text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChangeImage((currentIndex - 1 + images.length) % images.length);
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image */}
            <div className="relative w-full h-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: loaded ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  <Image
                    src={images[currentIndex]}
                    alt={`Image ${currentIndex + 1}`}
                    fill
                    className="object-contain"
                    onLoad={() => setLoaded(true)}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right arrow */}
            <button
              className="absolute right-4 z-40 p-2 text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChangeImage((currentIndex + 1) % images.length);
              }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </motion.div>

          {/* Filmstrip */}
          <div className="w-full max-w-4xl mt-4 px-4 overflow-x-auto">
            <div className="flex space-x-2 py-2">
              {images.map((image, index) => (
                <div
                  key={index}
                  className={`relative cursor-pointer transition-all duration-200 ${
                    index === currentIndex
                      ? 'border-2 border-white'
                      : 'border border-white/30 opacity-70 hover:opacity-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeImage(index);
                  }}
                >
                  <div className="w-20 h-12 relative">
                    <Image
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
