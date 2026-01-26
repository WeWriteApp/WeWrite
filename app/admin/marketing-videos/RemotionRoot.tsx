"use client";

import { Composition } from 'remotion';
import { HelloWorld } from './compositions/HelloWorld';
import { DonateToEveryPage } from './compositions/DonateToEveryPage';
import { BuildYourGraph } from './compositions/BuildYourGraph';
import { LandingPageHero } from './compositions/LandingPageHero';
import { UseCaseWriter } from './compositions/UseCaseWriter';
import { UseCaseReader } from './compositions/UseCaseReader';
import { BRAND_COLORS, DIMENSIONS } from './compositions/constants';

/**
 * Remotion Root
 *
 * Register all video compositions here
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Hello World */}
      <Composition
        id="HelloWorld-Horizontal"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          titleText: 'Welcome to WeWrite',
          titleColor: BRAND_COLORS.primary,
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="HelloWorld-Vertical"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          titleText: 'Welcome to WeWrite',
          titleColor: BRAND_COLORS.primary,
          orientation: 'vertical',
        }}
      />

      {/* Landing Page Hero */}
      <Composition
        id="LandingPageHero-Horizontal"
        component={LandingPageHero}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="LandingPageHero-Vertical"
        component={LandingPageHero}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          orientation: 'vertical',
        }}
      />

      {/* Donate to Every Page */}
      <Composition
        id="DonateToEveryPage-Horizontal"
        component={DonateToEveryPage}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="DonateToEveryPage-Vertical"
        component={DonateToEveryPage}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          orientation: 'vertical',
        }}
      />

      {/* Build Your Graph */}
      <Composition
        id="BuildYourGraph-Horizontal"
        component={BuildYourGraph}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="BuildYourGraph-Vertical"
        component={BuildYourGraph}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          orientation: 'vertical',
        }}
      />

      {/* Use Case: Writer */}
      <Composition
        id="UseCaseWriter-Horizontal"
        component={UseCaseWriter}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="UseCaseWriter-Vertical"
        component={UseCaseWriter}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          orientation: 'vertical',
        }}
      />

      {/* Use Case: Reader */}
      <Composition
        id="UseCaseReader-Horizontal"
        component={UseCaseReader}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.horizontal.width}
        height={DIMENSIONS.horizontal.height}
        defaultProps={{
          orientation: 'horizontal',
        }}
      />
      <Composition
        id="UseCaseReader-Vertical"
        component={UseCaseReader}
        durationInFrames={150}
        fps={30}
        width={DIMENSIONS.vertical.width}
        height={DIMENSIONS.vertical.height}
        defaultProps={{
          orientation: 'vertical',
        }}
      />
    </>
  );
};
