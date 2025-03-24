"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";

export const FeatureSection = () => {
  const features = [
    {
      title: "Multiple View Modes",
      description: "Choose between Wrapped, Default, and Spaced reading modes to customize your reading experience.",
      image: "/images/feature-1.png",
      points: [
        "Wrapped mode for compact viewing",
        "Default mode with standard spacing",
        "Spaced mode for enhanced readability"
      ]
    },
    {
      title: "Real-time Collaboration",
      description: "Work together with your team in real-time with our collaborative editing features.",
      image: "/images/feature-2.png",
      points: [
        "See who's editing in real-time",
        "Track changes with version history",
        "Comment and discuss within documents"
      ]
    },
    {
      title: "Recent Activity Tracking",
      description: "Stay updated with recent changes across your documents and team contributions.",
      image: "/images/feature-3.png",
      points: [
        "View recent edits with text previews",
        "See who made changes and when",
        "Track activity across all your pages"
      ]
    },
    {
      title: "Smart Paragraph Modes",
      description: "Choose between different paragraph display styles for optimal reading experience.",
      image: "/images/feature-4.png",
      points: [
        "Normal mode with traditional indentation",
        "Dense mode for continuous reading",
        "Smooth animations between modes"
      ]
    },
    {
      title: "Beautiful UI Experience",
      description: "Enjoy a clean, modern interface designed for both productivity and aesthetics.",
      image: "/images/feature-5.png",
      points: [
        "Dark and light theme support",
        "Responsive design for all devices",
        "Subtle animations for better feedback"
      ]
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Powerful Features for Modern Writing
          </motion.h2>
          <motion.p 
            className="text-xl text-muted-foreground max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            WeWrite combines powerful editing capabilities with a beautiful, intuitive interface
          </motion.p>
        </div>

        <div className="space-y-24">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="flex-1">
                <Card>
                  <CardHeader>
                    <Badge className="w-fit mb-2" variant="secondary">{`Feature ${index + 1}`}</Badge>
                    <CardTitle className="text-2xl">{feature.title}</CardTitle>
                    <CardDescription className="text-lg">{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Separator className="my-4" />
                    <ul className="space-y-3">
                      {feature.points.map((point, i) => (
                        <li key={i} className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="flex-1">
                <Card className="overflow-hidden border-border/40">
                  <CardContent className="p-0">
                    <div className="relative rounded-lg overflow-hidden shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 z-10"></div>
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        width={600}
                        height={400}
                        className="w-full h-auto relative z-0"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};