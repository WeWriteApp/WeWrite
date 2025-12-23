"use client";

import { useEffect, useRef } from 'react';
import Lottie from 'lottie-react';

interface LottieAnimationProps {
  animationData: any;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  size?: number;
}

export function LottieAnimation({
  animationData,
  className = "",
  loop = true,
  autoplay = true,
  size = 24
}: LottieAnimationProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

// Predefined animations for common use cases
export const TrophyAnimation = (props: Omit<LottieAnimationProps, 'animationData'>) => (
  <LottieAnimation
    {...props}
    animationData={{
      v: "5.7.1",
      meta: { g: "LottieFiles AE 1.0.0" },
      fr: 30,
      ip: 0,
      op: 60,
      w: 500,
      h: 500,
      nm: "Trophy",
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: "Trophy",
          sr: 1,
          ks: {
            o: { a: 0, k: 100, ix: 11 },
            r: { a: 0, k: 0, ix: 10 },
            p: { a: 0, k: [250, 250, 0], ix: 2 },
            a: { a: 0, k: [250, 250, 0], ix: 1 },
            s: { a: 0, k: [100, 100, 100], ix: 6 }
          },
          ao: 0,
          shapes: [
            {
              ty: "gr",
              it: [
                {
                  ty: "rc",
                  d: 1,
                  s: { a: 0, k: [100, 150], ix: 2 },
                  p: { a: 0, k: [0, -50], ix: 3 },
                  r: { a: 0, k: 10, ix: 4 }
                },
                {
                  ty: "fl",
                  c: { a: 0, k: [1, 0.8, 0, 1], ix: 4 },
                  o: { a: 0, k: 100, ix: 5 }
                },
                {
                  ty: "tr",
                  p: { a: 0, k: [250, 200], ix: 2 },
                  a: { a: 0, k: [0, 0], ix: 1 },
                  s: { a: 0, k: [100, 100], ix: 3 },
                  r: { a: 0, k: 0, ix: 6 },
                  o: { a: 0, k: 100, ix: 7 }
                }
              ]
            }
          ],
          ip: 0,
          op: 60,
          st: 0
        }
      ]
    }}
  />
);

export const StarAnimation = (props: Omit<LottieAnimationProps, 'animationData'>) => (
  <LottieAnimation
    {...props}
    animationData={{
      v: "5.7.1",
      meta: { g: "LottieFiles AE 1.0.0" },
      fr: 30,
      ip: 0,
      op: 60,
      w: 500,
      h: 500,
      nm: "Star",
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: "Star",
          sr: 1,
          ks: {
            o: { a: 0, k: 100, ix: 11 },
            r: { a: 0, k: 0, ix: 10 },
            p: { a: 0, k: [250, 250, 0], ix: 2 },
            a: { a: 0, k: [250, 250, 0], ix: 1 },
            s: { a: 0, k: [100, 100, 100], ix: 6 }
          },
          ao: 0,
          shapes: [
            {
              ty: "gr",
              it: [
                {
                  ty: "sr",
                  sy: 1,
                  d: 1,
                  pt: { a: 0, k: 5, ix: 3 },
                  p: { a: 0, k: [0, 0], ix: 4 },
                  r: { a: 0, k: 0, ix: 5 },
                  or: { a: 0, k: 50, ix: 7 },
                  os: { a: 0, k: 0, ix: 9 },
                  ix: 2
                },
                {
                  ty: "fl",
                  c: { a: 0, k: [1, 0.8, 0, 1], ix: 4 },
                  o: { a: 0, k: 100, ix: 5 }
                },
                {
                  ty: "tr",
                  p: { a: 0, k: [250, 250], ix: 2 },
                  a: { a: 0, k: [0, 0], ix: 1 },
                  s: { a: 0, k: [100, 100], ix: 3 },
                  r: { a: 0, k: 0, ix: 6 },
                  o: { a: 0, k: 100, ix: 7 }
                }
              ]
            }
          ],
          ip: 0,
          op: 60,
          st: 0
        }
      ]
    }}
  />
);

export const FireAnimation = (props: Omit<LottieAnimationProps, 'animationData'>) => (
  <LottieAnimation
    {...props}
    animationData={{
      v: "5.7.1",
      meta: { g: "LottieFiles AE 1.0.0" },
      fr: 30,
      ip: 0,
      op: 60,
      w: 500,
      h: 500,
      nm: "Fire",
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: "Fire",
          sr: 1,
          ks: {
            o: { a: 0, k: 100, ix: 11 },
            r: { a: 0, k: 0, ix: 10 },
            p: { a: 0, k: [250, 250, 0], ix: 2 },
            a: { a: 0, k: [250, 250, 0], ix: 1 },
            s: { a: 0, k: [100, 100, 100], ix: 6 }
          },
          ao: 0,
          shapes: [
            {
              ty: "gr",
              it: [
                {
                  ty: "rc",
                  d: 1,
                  s: { a: 0, k: [30, 60], ix: 2 },
                  p: { a: 0, k: [0, -15], ix: 3 },
                  r: { a: 0, k: 0, ix: 4 }
                },
                {
                  ty: "fl",
                  c: { a: 0, k: [1, 0.3, 0, 1], ix: 4 },
                  o: { a: 0, k: 100, ix: 5 }
                },
                {
                  ty: "tr",
                  p: { a: 0, k: [250, 235], ix: 2 },
                  a: { a: 0, k: [0, 0], ix: 1 },
                  s: { a: 0, k: [100, 100], ix: 3 },
                  r: { a: 0, k: 0, ix: 6 },
                  o: { a: 0, k: 100, ix: 7 }
                }
              ]
            }
          ],
          ip: 0,
          op: 60,
          st: 0
        }
      ]
    }}
  />
);