"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PillLink } from '../PillLink';
import { Flame, Loader } from 'lucide-react';
import { Sparkline } from '../ui/sparkline';
import { getPageViewsLast24Hours, getTrendingPages } from '../../firebase/pageViews';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
}

export default function TrendingPagesSection({ limit = 3 }) {
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);

        // Get trending pages for the last 24 hours
        const pages = await getTrendingPages(limit);

        // For each page, get the hourly view data for sparklines
        const pagesWithSparklines = await Promise.all(
          pages.map(async (page) => {
            try {
              const viewData = await getPageViewsLast24Hours(page.id);
              return {
                ...page,
                hourlyViews: viewData.hourly || Array(24).fill(0)
              };
            } catch (err) {
              console.error(`Error fetching view data for page ${page.id}:`, err);
              return {
                ...page,
                hourlyViews: Array(24).fill(0)
              };
            }
          })
        );

        setTrendingPages(pagesWithSparklines);
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError('Failed to load trending pages');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingPages();
  }, [limit]);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Trending on WeWrite</h2>
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

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

  // Always show the section, even if there's an error or no trending pages
  if (error || trendingPages.length === 0) {
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

          <Card className="max-w-lg mx-auto">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No trending pages available yet. Check back soon!</p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

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
                      {page.title || 'Untitled'}
                    </CardTitle>
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
