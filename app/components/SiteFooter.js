"use client";

import { useState } from "react";
import Link from "next/link";
import { Twitter, Heart, Map, Info, MessageSquare, Github } from 'lucide-react';

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

  const madeWithOptions = ["Made with agápē", "Vibe coded"];
  const locationOptions = ["in New York City", "in America", "on Earth"];

  const handleMadeWithClick = () => {
    setMadeWithIndex((prevIndex) => (prevIndex + 1) % madeWithOptions.length);
  };

  const handleLocationClick = () => {
    setLocationIndex((prevIndex) => (prevIndex + 1) % locationOptions.length);
  };

  const footerLinks = [
    {
      href: "https://x.com/WeWriteApp",
      label: "X",
      icon: <Twitter className="h-3 w-3" />,
      external: true
    },
    {
      href: "https://github.com/WeWriteApp/WeWrite",
      label: "GitHub",
      icon: <Github className="h-3 w-3" />,
      external: true
    },
    {
      href: "/support",
      label: "Support us",
      icon: <Heart className="h-3 w-3" />,
      external: false
    },
    {
      href: "/zRNwhNgIEfLFo050nyAT",
      label: "Roadmap",
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
    <footer className={`w-full py-4 px-4 border-t-only backdrop-blur-sm ${className}`}>
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

        <div className="text-xs text-muted-foreground">
          <span
            onClick={handleMadeWithClick}
            className="cursor-pointer hover:text-foreground transition-colors"
            title="Click me!"
          >
            {madeWithOptions[madeWithIndex]}
          </span>{" "}
          <span
            onClick={handleLocationClick}
            className="cursor-pointer hover:text-foreground transition-colors"
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
