"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Code, Server, Palette, Zap, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";

export const DeveloperSection = () => {
  const techStack = [
    {
      icon: <Code className="h-8 w-8 text-primary" />,
      title: "Next.js & TypeScript",
      description: "Built with Next.js 14 and TypeScript for type-safe, performant web applications."
    },
    {
      icon: <Server className="h-8 w-8 text-primary" />,
      title: "Firebase Backend",
      description: "Powered by Firebase for authentication, real-time database, and secure storage."
    },
    {
      icon: <Palette className="h-8 w-8 text-primary" />,
      title: "Modern UI Libraries",
      description: "Using Shadcn UI, Radix, and NextUI components for a beautiful, accessible interface."
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "Framer Motion",
      description: "Smooth animations and transitions powered by Framer Motion."
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Collaborative Editing",
      description: "Real-time collaboration with conflict resolution and version tracking."
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built with Modern Technology</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            WeWrite is powered by the latest web technologies for a fast, reliable experience
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {techStack.map((tech, index) => (
            <div key={index} className="bg-card border border-border/40 rounded-lg p-6 shadow-sm">
              <div className="mb-4">{tech.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{tech.title}</h3>
              <p className="text-muted-foreground">{tech.description}</p>
            </div>
          ))}
        </motion.div>

        <motion.div 
          className="mt-12 relative rounded-lg overflow-hidden shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 z-10"></div>
          <Image
            src="/images/tech-stack.png"
            alt="WeWrite Technology Stack"
            width={1200}
            height={600}
            className="w-full h-auto relative z-0"
          />
        </motion.div>

        <Separator className="my-12 max-w-2xl mx-auto opacity-50" />

        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of writers, teams, and content creators who are already using WeWrite to streamline their workflow.
          </p>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
            <Link href="/auth/register">Create Your Free Account</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};