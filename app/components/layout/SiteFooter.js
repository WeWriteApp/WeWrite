"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { X, Heart, Map, Info, MessageSquare, Github } from 'lucide-react';

/**
 * SiteFooter component for the application.
 * Displays links to various pages and external resources.
 *
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes to apply to the footer
 */
export default function SiteFooter({ className = "" }) {
  const currentYear = new Date().getFullYear();

  // Interactive footer text options
  const [madeWithIndex, setMadeWithIndex] = useState(0);
  const [locationIndex, setLocationIndex] = useState(0);
  const [isAnimatingMadeWith, setIsAnimatingMadeWith] = useState(false);
  const [isAnimatingLocation, setIsAnimatingLocation] = useState(false);
  const madeWithRef = useRef(null);
  const locationRef = useRef(null);

  const madeWithOptions = ["Made with agápē", "Vibe coded"];
  const locationOptions = ["in America", "in New York City", "on Earth"];

  const animateTextChange = (element, newText, callback) => {
    if (!element) return;

    const originalText = element.innerText;
    const frames = 10; // Number of animation frames
    let frame = 0;

    const animate = () => {
      if (frame < frames) {
        // During first half, scramble the text
        if (frame < frames / 2) {
          const progress = frame / (frames / 2);
          const scrambleLength = Math.floor(originalText.length * progress);
          const keepLength = originalText.length - scrambleLength;

          let scrambledText = originalText.substring(0, keepLength);
          for (let i = 0; i < scrambleLength; i++) {
            scrambledText += String.fromCharCode(33 + Math.floor(Math.random() * 94)); // Random ASCII
          }

          element.innerText = scrambledText;
        }
        // During second half, reveal the new text
        else {
          const progress = (frame - frames / 2) / (frames / 2);
          const revealLength = Math.floor(newText.length * progress);

          let revealedText = newText.substring(0, revealLength);
          for (let i = 0; i < newText.length - revealLength; i++) {
            revealedText += String.fromCharCode(33 + Math.floor(Math.random() * 94)); // Random ASCII
          }

          element.innerText = revealedText;
        }

        frame++;
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        element.innerText = newText;
        callback();
      }
    };

    animate();
  };

  const handleMadeWithClick = () => {
    if (isAnimatingMadeWith) return;

    setIsAnimatingMadeWith(true);
    const nextIndex = (madeWithIndex + 1) % madeWithOptions.length;

    animateTextChange(
      madeWithRef.current,
      madeWithOptions[nextIndex],
      () => {
        setMadeWithIndex(nextIndex);
        setIsAnimatingMadeWith(false);
      }
    );
  };

  const handleLocationClick = () => {
    if (isAnimatingLocation) return;

    setIsAnimatingLocation(true);
    const nextIndex = (locationIndex + 1) % locationOptions.length;

    animateTextChange(
      locationRef.current,
      locationOptions[nextIndex],
      () => {
        setLocationIndex(nextIndex);
        setIsAnimatingLocation(false);
      }
    );
  };

  const footerLinks = [
    {
      href: "https://x.com/WeWriteApp",
      label: "X",
      icon: <X className="h-3 w-3" />,
      external: true
    },
    {
      href: "https://github.com/WeWriteApp/WeWrite",
      label: "GitHub",
      icon: <Github className="h-3 w-3" />,
      external: true
    },
    {
      href: "/subscription",
      label: "Support us",
      icon: <Heart className="h-3 w-3" />,
      external: false
    },
    {
      href: "/zRNwhNgIEfLFo050nyAT",
      label: "Feature Roadmap",
      icon: <Map className="h-3 w-3" />,
      external: false
    },
    {
      href: "/sUASL4gNdCMVHkr7Qzty",
      label: "About us",
      icon: <Info className="h-3 w-3" />,
      external: false
    },
    {
      href: "/Kva5XqFpFb2bl5TCZoxE",
      label: "Feedback",
      icon: <MessageSquare className="h-3 w-3" />,
      external: false
    }
  ];

  return (
    <footer className={`w-full py-4 px-4 border-t-only bg-background ${className}`}>
      <div className="container mx-auto flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-4">
          {footerLinks.map((link, index) => (
            <Link
              key={index}
              href={link.href}
              target={(link.external || link.forceNewTab) ? "_blank" : undefined}
              rel={(link.external || link.forceNewTab) ? "noopener noreferrer" : undefined}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 group"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="text-xs text-muted-foreground select-none">
          <span
            ref={madeWithRef}
            onClick={handleMadeWithClick}
            className="cursor-pointer hover:text-foreground transition-colors select-none"
            title="Click me!"
          >
            {madeWithOptions[madeWithIndex]}
          </span>{" "}
          <span
            ref={locationRef}
            onClick={handleLocationClick}
            className="cursor-pointer hover:text-foreground transition-colors select-none"
            title="Click me too!"
          >
            {locationOptions[locationIndex]}
          </span>
        </div>

        {/* Add extra padding to ensure content isn't covered by pledge bar */}
        <div className="h-24"></div>
      </div>
    </footer>
  );
}
