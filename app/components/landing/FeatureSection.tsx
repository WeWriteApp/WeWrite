"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";

interface FeatureProps {
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
}

function Feature({
  title,
  description,
  linkText,
  linkHref,
  imageSrc,
  imageAlt,
  reverse = false
}: FeatureProps) {
  return (
    <div className={`grid gap-6 items-center ${reverse ? 'lg:grid-cols-[400px_1fr]' : 'lg:grid-cols-[1fr_400px]'} lg:gap-12`}>
      {/* Image - conditionally ordered based on reverse prop */}
      <div className={`flex items-center justify-center ${reverse ? 'lg:order-1' : 'lg:order-2'}`}>
        <div className="relative w-full max-w-[400px] aspect-[4/3] overflow-hidden rounded-xl bg-blue-950/30">
          {/* Fallback div in case image is missing */}
          <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold">
            {title}
          </div>
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover"
            onError={(e) => {
              // Hide the image on error
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </div>
      
      {/* Content - conditionally ordered based on reverse prop */}
      <div className={`flex flex-col justify-center space-y-4 ${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl">{title}</h2>
          <p className="max-w-[600px] text-gray-300 md:text-lg">{description}</p>
        </div>
        <div>
          <Link href={linkHref}>
            <Button variant="link" className="p-0 text-blue-500 hover:text-blue-400">
              {linkText}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FeatureSection() {
  // Feature data - currently blank placeholders as requested
  const features: FeatureProps[] = [
    {
      title: "Every page is a fundraiser",
      description: "Readers donate a small slice of their monthly budget to your pages, giving you a sustainable income.",
      linkText: "Read on WeWrite",
      linkHref: "/auth/register",
      imageSrc: "/images/feature-1.png",
      imageAlt: "Fundraiser feature illustration"
    },
    {
      title: "Social and active",
      description: "See everyone else's public pages and all the activities of how the pages change over time.",
      linkText: "Read on WeWrite",
      linkHref: "/auth/register",
      imageSrc: "/images/feature-2.png",
      imageAlt: "Social feature illustration",
      reverse: true
    },
    {
      title: "Versioned over time",
      description: "Each page has version history, the idea is that more donations will inspire the writer to make more improvements.",
      linkText: "Read on WeWrite",
      linkHref: "/auth/register",
      imageSrc: "/images/feature-3.png",
      imageAlt: "Version history feature illustration"
    },
    {
      title: "Beautiful reading experience",
      description: "Choose from multiple view modes including Wrapped, Default, and Spaced to customize your reading experience.",
      linkText: "Read on WeWrite",
      linkHref: "/auth/register",
      imageSrc: "/images/feature-4.png",
      imageAlt: "Reading experience feature illustration",
      reverse: true
    },
    {
      title: "Connect your ideas",
      description: "Link pages together to create a network of interconnected ideas, making it easier for readers to explore your content.",
      linkText: "Read on WeWrite",
      linkHref: "/auth/register",
      imageSrc: "/images/feature-5.png",
      imageAlt: "Connected ideas feature illustration"
    }
  ];

  return (
    <section className="w-full py-12 md:py-24 bg-black" id="features">
      <div className="container px-4 md:px-6 space-y-16">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Features</h2>
          <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl">
            Discover how WeWrite helps you create, share, and monetize your content.
          </p>
        </div>
        
        <div className="space-y-20">
          {features.map((feature, index) => (
            <Feature key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
