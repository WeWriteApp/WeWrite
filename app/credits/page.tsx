"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../components/ui/button';
import Link from 'next/link';

interface Credit {
  name: string;
  description: string;
  url: string;
  category: 'framework' | 'ui' | 'visualization' | 'infrastructure' | 'editor' | 'utility';
}

const credits: Credit[] = [
  // Framework
  { name: 'Next.js', description: 'React framework for production', url: 'https://nextjs.org', category: 'framework' },
  { name: 'React', description: 'JavaScript library for building user interfaces', url: 'https://react.dev', category: 'framework' },
  { name: 'TypeScript', description: 'Typed JavaScript at any scale', url: 'https://typescriptlang.org', category: 'framework' },

  // UI & Design
  { name: 'Tailwind CSS', description: 'Utility-first CSS framework', url: 'https://tailwindcss.com', category: 'ui' },
  { name: 'shadcn/ui', description: 'Beautifully designed components built with Radix UI', url: 'https://ui.shadcn.com', category: 'ui' },
  { name: 'Radix UI', description: 'Unstyled, accessible UI components', url: 'https://radix-ui.com', category: 'ui' },
  { name: 'Lucide', description: 'Beautiful and consistent icons', url: 'https://lucide.dev', category: 'ui' },
  { name: 'Lordicon', description: 'Animated icon library', url: 'https://lordicon.com', category: 'ui' },

  // 3D & Visualization
  { name: '3d-force-graph', description: 'Interactive 3D force-directed graph visualization', url: 'https://github.com/vasturiano/3d-force-graph', category: 'visualization' },
  { name: 'Three.js', description: '3D graphics library for the web', url: 'https://threejs.org', category: 'visualization' },
  { name: 'Recharts', description: 'Composable charting library for React', url: 'https://recharts.org', category: 'visualization' },
  { name: 'Mapbox GL', description: 'Interactive, customizable maps', url: 'https://mapbox.com', category: 'visualization' },

  // Editor
  { name: 'Slate', description: 'Customizable rich text editor framework', url: 'https://docs.slatejs.org', category: 'editor' },

  // Infrastructure
  { name: 'Firebase', description: 'App development platform by Google', url: 'https://firebase.google.com', category: 'infrastructure' },
  { name: 'Stripe', description: 'Payment processing infrastructure', url: 'https://stripe.com', category: 'infrastructure' },
  { name: 'Vercel', description: 'Cloud platform for frontend developers', url: 'https://vercel.com', category: 'infrastructure' },

  // Utilities
  { name: 'date-fns', description: 'Modern JavaScript date utility library', url: 'https://date-fns.org', category: 'utility' },
  { name: 'Zod', description: 'TypeScript-first schema validation', url: 'https://zod.dev', category: 'utility' },
  { name: 'React Hook Form', description: 'Performant form validation', url: 'https://react-hook-form.com', category: 'utility' },
];

const categoryLabels: Record<Credit['category'], string> = {
  framework: 'Core Framework',
  ui: 'UI & Design',
  visualization: '3D & Visualization',
  editor: 'Editor',
  infrastructure: 'Infrastructure',
  utility: 'Utilities',
};

const categoryIcons: Record<Credit['category'], string> = {
  framework: 'Code2',
  ui: 'Palette',
  visualization: 'BarChart3',
  editor: 'FileText',
  infrastructure: 'Cloud',
  utility: 'Wrench',
};

export default function CreditsPage() {
  const groupedCredits = credits.reduce((acc, credit) => {
    if (!acc[credit.category]) {
      acc[credit.category] = [];
    }
    acc[credit.category].push(credit);
    return acc;
  }, {} as Record<Credit['category'], Credit[]>);

  const categoryOrder: Credit['category'][] = ['framework', 'ui', 'visualization', 'editor', 'infrastructure', 'utility'];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/">
            <Icon name="ArrowLeft" size={16} />
            Back
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Credits</h1>
        <p className="text-muted-foreground">
          WeWrite is built on the shoulders of giants. We're grateful to the open source community
          and these amazing projects that make our work possible.
        </p>
      </div>

      <div className="space-y-8">
        {categoryOrder.map((category) => {
          const categoryCredits = groupedCredits[category];
          if (!categoryCredits) return null;

          return (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name={categoryIcons[category]} size={20} />
                {categoryLabels[category]}
              </h2>
              <div className="grid gap-3">
                {categoryCredits.map((credit) => (
                  <a
                    key={credit.name}
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wewrite-card hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium group-hover:text-primary transition-colors">
                          {credit.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {credit.description}
                        </p>
                      </div>
                      <Icon
                        name="ExternalLink"
                        size={16}
                        className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"
                      />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>
          Thank you to all the maintainers, contributors, and communities
          behind these projects.
        </p>
      </div>
    </div>
  );
}
