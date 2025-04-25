"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { PillLink } from '../PillLink';
import { Flame, User } from 'lucide-react';
import { Sparkline } from '../ui/sparkline';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Mock data for trending pages
const mockTrendingPages = [
  {
    id: "RFsPq1tbcOMtljwHyIMT",
    title: "Every Page is a Fundraiser",
    views: 1245,
    hourlyViews: [2, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110],
    username: "jamiegray"
  },
  {
    id: "aJFMqTEKuNEHvOrYE9c2",
    title: "No Ads",
    views: 987,
    hourlyViews: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 45, 40, 35, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    username: "wewrite"
  },
  {
    id: "ou1LPmpynpoirLrv99fq",
    title: "Multiple View Modes",
    views: 756,
    hourlyViews: [10, 15, 20, 25, 30, 35, 30, 25, 20, 25, 30, 35, 40, 45, 50, 55, 50, 45, 40, 35, 30, 25, 20, 15],
    username: "admin"
  }
];

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export default function LandingTrendingSection({ limit = 3 }) {
  const trendingPages = mockTrendingPages.slice(0, limit);

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <h2 className="text-3xl font-bold text-center mb-12 flex items-center justify-center gap-2">
            <Flame className="h-8 w-8 text-muted-foreground" />
            <span>Trending on WeWrite</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {trendingPages.map((page, index) => (
            <motion.div
              key={page.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/${page.id}`} className="block h-full">
                <Card className="h-full hover:shadow-md transition-shadow duration-200 cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      <PillLink href={`/${page.id}`}>
                        {page.title || 'Untitled'}
                      </PillLink>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <User className="h-3 w-3" />
                      {page.username || 'Anonymous'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="font-medium text-muted-foreground">
                        {page.views.toLocaleString()} views in 24h
                      </div>
                      <div className="w-24 h-10">
                        <Sparkline
                          data={page.hourlyViews}
                          height={40}
                          color="#1768FF"
                          strokeWidth={1.5}
                          fillOpacity={0.1}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
