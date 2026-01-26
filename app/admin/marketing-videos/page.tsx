"use client";

import { useState } from 'react';
import { Player } from '@remotion/player';
import { DonateToEveryPage } from './compositions/DonateToEveryPage';
import { BuildYourGraph } from './compositions/BuildYourGraph';
import { LandingPageHero } from './compositions/LandingPageHero';
import { UseCaseWriter } from './compositions/UseCaseWriter';
import { UseCaseReader } from './compositions/UseCaseReader';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { BRAND_COLORS, DIMENSIONS, TIMINGS } from './compositions/constants';

interface CompositionInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  Component: React.ComponentType<any>;
  layers: {
    name: string;
    type: 'background' | 'graphic' | 'text' | 'animation';
    timing: string;
    color?: string;
  }[];
}

const COMPOSITIONS: CompositionInfo[] = [
  {
    id: 'LandingPageHero',
    name: 'Landing Page Hero',
    description: 'Main WeWrite marketing pitch with animated title and tagline',
    category: 'Landing Page',
    Component: LandingPageHero,
    layers: [
      { name: 'Black Background', type: 'background', timing: '0-5s', color: '#000000' },
      { name: 'Blue Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.primary },
      { name: 'Purple Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.purple },
      { name: 'Green Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.green },
      { name: 'WeWrite Title', type: 'text', timing: '0-1.3s (fade + scale)', color: '#FFFFFF' },
      { name: 'Tagline', type: 'text', timing: '1-1.7s (slide up)', color: BRAND_COLORS.primary },
    ],
  },
  {
    id: 'DonateToEveryPage',
    name: 'Donate to Every Page',
    description: 'Feature showcase for micro-donation functionality',
    category: 'Features',
    Component: DonateToEveryPage,
    layers: [
      { name: 'Black Background', type: 'background', timing: '0-5s', color: '#000000' },
      { name: 'Blue Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.primary },
      { name: 'Green Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.green },
      { name: 'Gift Icon 💝', type: 'graphic', timing: '0-1s (fade), 1.3-2s (pulse)', color: undefined },
      { name: 'Feature Title', type: 'text', timing: '0-1s (fade + scale)', color: BRAND_COLORS.primary },
      { name: 'Feature Description', type: 'text', timing: '0-1s (fade + scale)', color: '#FFFFFF' },
    ],
  },
  {
    id: 'BuildYourGraph',
    name: 'Build Your Graph',
    description: 'Feature showcase for knowledge graph connections',
    category: 'Features',
    Component: BuildYourGraph,
    layers: [
      { name: 'Black Background', type: 'background', timing: '0-5s', color: '#000000' },
      { name: 'Purple Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.purple },
      { name: 'Blue Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.primary },
      { name: 'Node 1 (📄)', type: 'graphic', timing: '1.3-1.7s (fade in)', color: BRAND_COLORS.primary },
      { name: 'Connection Line 1', type: 'graphic', timing: '1.7-2s (fade in)', color: BRAND_COLORS.purple },
      { name: 'Node 2 (🔗)', type: 'graphic', timing: '1.7-2s (fade in)', color: BRAND_COLORS.purple },
      { name: 'Connection Line 2', type: 'graphic', timing: '2-2.3s (fade in)', color: BRAND_COLORS.green },
      { name: 'Node 3 (✨)', type: 'graphic', timing: '2-2.3s (fade in)', color: BRAND_COLORS.green },
      { name: 'Feature Title', type: 'text', timing: '0-1s (fade + scale)', color: BRAND_COLORS.purple },
      { name: 'Feature Description', type: 'text', timing: '0-1s (fade + scale)', color: '#FFFFFF' },
    ],
  },
  {
    id: 'UseCaseWriter',
    name: 'For Writers',
    description: 'Use case highlighting benefits for content creators',
    category: 'Use Cases',
    Component: UseCaseWriter,
    layers: [
      { name: 'Black Background', type: 'background', timing: '0-5s', color: '#000000' },
      { name: 'Blue Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.primary },
      { name: 'Orange Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.orange },
      { name: 'Writer Icon ✍️', type: 'graphic', timing: '0-1s (fade + scale)', color: undefined },
      { name: 'Title', type: 'text', timing: '0-1s (fade + scale)', color: BRAND_COLORS.primary },
      { name: 'Feature 1', type: 'text', timing: '1.7-2s (fade in)', color: '#FFFFFF' },
      { name: 'Feature 2', type: 'text', timing: '2-2.3s (fade in)', color: '#FFFFFF' },
      { name: 'Feature 3', type: 'text', timing: '2.3-2.7s (fade in)', color: '#FFFFFF' },
    ],
  },
  {
    id: 'UseCaseReader',
    name: 'For Readers',
    description: 'Use case highlighting benefits for content consumers',
    category: 'Use Cases',
    Component: UseCaseReader,
    layers: [
      { name: 'Black Background', type: 'background', timing: '0-5s', color: '#000000' },
      { name: 'Green Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.green },
      { name: 'Blue Gradient Blob', type: 'background', timing: '0-5s', color: BRAND_COLORS.primary },
      { name: 'Reader Icon 📚', type: 'graphic', timing: '0-1s (fade + scale)', color: undefined },
      { name: 'Title', type: 'text', timing: '0-1s (fade + scale)', color: BRAND_COLORS.green },
      { name: 'Feature 1', type: 'text', timing: '1.7-2s (fade in)', color: '#FFFFFF' },
      { name: 'Feature 2', type: 'text', timing: '2-2.3s (fade in)', color: '#FFFFFF' },
      { name: 'Feature 3', type: 'text', timing: '2.3-2.7s (fade in)', color: '#FFFFFF' },
    ],
  },
];

const LayerTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'background':
      return <Icon name="Layers" size={14} />;
    case 'graphic':
      return <Icon name="Sparkles" size={14} />;
    case 'text':
      return <Icon name="Type" size={14} />;
    case 'animation':
      return <Icon name="Zap" size={14} />;
    default:
      return <Icon name="Circle" size={14} />;
  }
};

/**
 * Marketing Videos Page
 *
 * Gallery view showing all compositions with timelines
 */
export default function MarketingVideosPage() {
  const [expandedCompositions, setExpandedCompositions] = useState<Set<string>>(new Set());

  const toggleComposition = (id: string) => {
    setExpandedCompositions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Marketing Videos</h1>
        <p className="text-muted-foreground text-sm">
          All compositions with layer breakdowns and timelines
        </p>
      </div>

      {/* Compositions Gallery */}
      <div className="space-y-12">
        {COMPOSITIONS.map((comp) => {
          const isExpanded = expandedCompositions.has(comp.id);

          return (
            <div key={comp.id} className="space-y-4">
              {/* Composition Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">{comp.name}</h2>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {comp.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{comp.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleComposition(comp.id)}
                  className="ml-4"
                >
                  <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} className="mr-2" />
                  {isExpanded ? "Hide" : "Show"} Details
                </Button>
              </div>

              {/* Main Content Card */}
              <div className="wewrite-card p-6 space-y-6">
                {/* Video Players */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Horizontal Version */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="RectangleHorizontal" size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Horizontal (16:9)</span>
                      <span className="text-xs text-muted-foreground ml-auto">1920×1080</span>
                    </div>
                    <div className="bg-background border border-border rounded-lg overflow-hidden">
                      <Player
                        component={comp.Component}
                        durationInFrames={150}
                        fps={30}
                        compositionWidth={DIMENSIONS.horizontal.width}
                        compositionHeight={DIMENSIONS.horizontal.height}
                        inputProps={{ orientation: 'horizontal' }}
                        style={{
                          width: '100%',
                          aspectRatio: '16/9',
                        }}
                        controls
                        loop
                        autoPlay
                      />
                    </div>
                  </div>

                  {/* Vertical Version */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="RectangleVertical" size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Vertical (9:16)</span>
                      <span className="text-xs text-muted-foreground ml-auto">1080×1920</span>
                    </div>
                    <div className="bg-background border border-border rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '400px' }}>
                      <Player
                        component={comp.Component}
                        durationInFrames={150}
                        fps={30}
                        compositionWidth={DIMENSIONS.vertical.width}
                        compositionHeight={DIMENSIONS.vertical.height}
                        inputProps={{ orientation: 'vertical' }}
                        style={{
                          width: '100%',
                          aspectRatio: '9/16',
                        }}
                        controls
                        loop
                        autoPlay
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <>
                    {/* Layer Timeline */}
                    <div className="border-t border-border pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Layers" size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Composition Layers & Timeline</h3>
                    <span className="text-xs text-muted-foreground ml-auto">5 seconds @ 30fps</span>
                  </div>

                  <div className="space-y-2">
                    {comp.layers.map((layer, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        {/* Layer Icon */}
                        <div className="text-muted-foreground">
                          <LayerTypeIcon type={layer.type} />
                        </div>

                        {/* Layer Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{layer.name}</span>
                            {layer.color && (
                              <div
                                className="w-4 h-4 rounded border border-border"
                                style={{ backgroundColor: layer.color }}
                                title={layer.color}
                              />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">
                            {layer.type}
                          </span>
                        </div>

                        {/* Timing */}
                        <div className="text-right">
                          <span className="text-xs font-mono text-muted-foreground">
                            {layer.timing}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Timeline Visualization */}
                  <div className="mt-4 p-4 bg-muted/20 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>0s</span>
                      <span>1s</span>
                      <span>2s</span>
                      <span>3s</span>
                      <span>4s</span>
                      <span>5s</span>
                    </div>
                    <div className="h-2 bg-gradient-to-r from-primary/20 via-purple/20 to-green/20 rounded-full" />
                  </div>
                </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="wewrite-card bg-muted/30 p-6">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-primary mt-0.5" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">About These Compositions</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All videos are 5 seconds at 30fps (150 frames)</li>
              <li>Each composition has both horizontal (16:9) and vertical (9:16) variants</li>
              <li>Layers show the build order and animation timing</li>
              <li>Background gradients use brand colors for consistency</li>
              <li>Export functionality coming soon</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Resources Card */}
      <div className="wewrite-card p-6">
        <div className="flex items-start gap-3">
          <Icon name="Lightbulb" size={20} className="text-primary mt-0.5" />
          <div className="space-y-4 text-sm flex-1">
            <div>
              <p className="font-medium text-foreground mb-2">Resources & Tools</p>
              <div className="space-y-3">
                {/* Remotion Link */}
                <div className="flex items-start gap-2">
                  <Icon name="ExternalLink" size={16} className="text-muted-foreground mt-0.5" />
                  <div>
                    <a
                      href="https://www.remotion.dev/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Remotion Documentation
                    </a>
                    <p className="text-muted-foreground text-xs mt-1">
                      Official Remotion docs - Learn about animations, compositions, and video rendering
                    </p>
                  </div>
                </div>

                {/* Claude for Design */}
                <div className="flex items-start gap-2">
                  <Icon name="Sparkles" size={16} className="text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Design Videos with Claude</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Use Claude Code to help design new compositions, animations, and visual effects.
                      Ask Claude to create new marketing videos, adjust timing, or experiment with different layouts.
                    </p>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                      Example: "Create a new composition for our pricing page with a fade-in animation"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
