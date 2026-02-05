"use client";

import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from 'remotion';
import { LandingPageHero } from './LandingPageHero';
import { DonateToEveryPage } from './DonateToEveryPage';
import { BuildYourGraph } from './BuildYourGraph';
import { UseCaseWriter } from './UseCaseWriter';
import { UseCaseReader } from './UseCaseReader';
import { SCENE_CONFIG, calculateSceneTiming } from './constants';

/**
 * Transition component - cross-fade between scenes
 */
const CrossFadeTransition: React.FC<{
  children: React.ReactNode;
  direction?: 'in' | 'out';
}> = ({ children, direction = 'in' }) => {
  const frame = useCurrentFrame();
  const { transitionLength } = SCENE_CONFIG;

  const opacity = interpolate(
    frame,
    [0, transitionLength],
    direction === 'in' ? [0, 1] : [1, 0],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Scene configuration type
 */
export interface SceneConfig {
  id: string;
  name: string;
  Component: React.ComponentType<any>;
  category: string;
}

/**
 * Master Composition - All scenes combined with transitions
 */
export const MasterComposition: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  scenes?: SceneConfig[];
}> = ({ orientation = 'horizontal', scenes }) => {
  const frame = useCurrentFrame();

  // Default scene order
  const defaultScenes: SceneConfig[] = [
    { id: 'hero', name: 'Landing Page Hero', Component: LandingPageHero, category: 'Landing Page' },
    { id: 'donate', name: 'Donate to Every Page', Component: DonateToEveryPage, category: 'Features' },
    { id: 'graph', name: 'Build Your Graph', Component: BuildYourGraph, category: 'Features' },
    { id: 'writer', name: 'For Writers', Component: UseCaseWriter, category: 'Use Cases' },
    { id: 'reader', name: 'For Readers', Component: UseCaseReader, category: 'Use Cases' },
  ];

  const sceneList = scenes || defaultScenes;
  const { sceneLength, transitionLength } = SCENE_CONFIG;

  return (
    <AbsoluteFill>
      {sceneList.map((scene, index) => {
        const timing = calculateSceneTiming(index);
        const isLastScene = index === sceneList.length - 1;

        return (
          <Sequence
            key={scene.id}
            from={timing.start}
            durationInFrames={sceneLength + (isLastScene ? 0 : transitionLength)}
          >
            <AbsoluteFill>
              {/* Main scene content */}
              <Sequence from={0} durationInFrames={sceneLength}>
                <scene.Component orientation={orientation} />
              </Sequence>

              {/* Fade out transition (except for last scene) */}
              {!isLastScene && (
                <Sequence from={sceneLength} durationInFrames={transitionLength}>
                  <CrossFadeTransition direction="out">
                    <scene.Component orientation={orientation} />
                  </CrossFadeTransition>
                </Sequence>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Calculate total duration of master composition
 */
export const calculateMasterDuration = (sceneCount: number = 5): number => {
  const { sceneLength, transitionLength } = SCENE_CONFIG;
  // Last scene doesn't have a transition
  return (sceneCount * sceneLength) + ((sceneCount - 1) * transitionLength);
};
