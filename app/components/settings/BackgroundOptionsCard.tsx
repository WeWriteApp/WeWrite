"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../providers/ThemeProvider';
import { useAppBackground, type ImageBackground } from '../../contexts/AppBackgroundContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../ui/segmented-control';
import { Button } from '../ui/button';
import { Lock, Palette, Image as ImageIcon } from 'lucide-react';
import OKLCHColorSlider from './OKLCHColorSlider';
import ColorSlider from './ColorSlider';
import BackgroundImageUpload from './BackgroundImageUpload';
import { oklchToHex } from '../../utils/colorConversions';

export default function BackgroundOptionsCard() {
  const router = useRouter();
  const { theme } = useTheme();
  const { 
    background, 
    setBackground, 
    backgroundBlur, 
    setBackgroundBlur,
    lastUploadedImage 
  } = useAppBackground();
  const { hasActiveSubscription } = useSubscription();
  
  // Default to 'color' tab, but switch to 'image' if currently using an image background
  const [activeTab, setActiveTab] = useState(background.type === 'image' ? 'image' : 'color');

  // Get background OKLCH for color slider
  const backgroundOklch = background.type === 'solid' 
    ? (theme === 'dark' ? background.oklchDark : background.oklchLight) || '0.00% 0.0000 0.0'
    : '98.22% 0.0061 255.5'; // Default light background

  const handleBackgroundChange = (hexColor: string) => {
    // Convert hex to OKLCH and create new solid background
    // This is a simplified conversion - the actual conversion would use proper color space conversion
    const newBackground = {
      type: 'solid' as const,
      color: hexColor,
      darkColor: theme === 'dark' ? hexColor : '#000000',
      oklchLight: theme === 'light' ? backgroundOklch : '98.22% 0.0061 255.5',
      oklchDark: theme === 'dark' ? backgroundOklch : '0.00% 0.0000 0.0'
    };
    setBackground(newBackground);
  };

  const switchToUploadedImage = () => {
    if (lastUploadedImage) {
      const imageBackground: ImageBackground = {
        type: 'image',
        url: lastUploadedImage,
        opacity: 0.15
      };
      setBackground(imageBackground);
      setActiveTab('image');
    }
  };

  const handleDefaultImageSelect = (slot: number) => {
    const imageBackground: ImageBackground = {
      type: 'image',
      url: `/images/backgrounds/default-${slot}.png`,
      opacity: 0.15
    };
    setBackground(imageBackground);
  };

  return (
    <div className="space-y-4">
      {/* Segmented Control for Color/Image */}
      <SegmentedControl value={activeTab} onValueChange={setActiveTab}>
        <SegmentedControlList>
          <SegmentedControlTrigger value="color" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Color
          </SegmentedControlTrigger>
          <SegmentedControlTrigger value="image" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Image
          </SegmentedControlTrigger>
        </SegmentedControlList>

        {/* Color Tab Content */}
        <SegmentedControlContent value="color" className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Background Color</label>
            <OKLCHColorSlider
              value={oklchToHex(backgroundOklch)}
              onChange={handleBackgroundChange}
              hiddenSliders={['hue']} // Hide hue - inherits from accent
              limits={{
                lightness: theme === 'dark'
                  ? { min: 0.0, max: 0.20 }   // Dark mode: 0-20% (black to very dark grey)
                  : { min: 0.80, max: 1.0 },  // Light mode: 80-100% (very light grey to white)
                chroma: { min: 0.0, max: 0.05 }, // Very limited chroma for backgrounds
              }}
            />
          </div>
        </SegmentedControlContent>

        {/* Image Tab Content */}
        <SegmentedControlContent value="image" className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Default Backgrounds</label>

            {/* Default Background Image Slots */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3].map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleDefaultImageSelect(slot)}
                  className={`aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-center ${
                    background.type === 'image' && background.url === `/images/backgrounds/default-${slot}.png`
                      ? 'border-primary bg-primary/10'
                      : ''
                  }`}
                >
                  <div className="text-center">
                    <ImageIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Slot {slot}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Upload Section */}
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Upload</label>
              <div className="space-y-3">
                {hasActiveSubscription ? (
                  <>
                    <BackgroundImageUpload />

                    {/* Overlay Opacity Slider - only show when using image background */}
                    {background.type === 'image' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Overlay Opacity</label>
                          <span className="text-sm text-muted-foreground">
                            {Math.round((background.opacity || 0.15) * 100)}%
                          </span>
                        </div>
                        <ColorSlider
                          value={(background.opacity || 0.15) * 100}
                          onChange={(value) => {
                            const newOpacity = value / 100;
                            const updatedBackground: ImageBackground = {
                              ...background,
                              opacity: newOpacity
                            };
                            setBackground(updatedBackground);

                            // Immediately update the overlay for instant feedback
                            const root = document.documentElement;
                            const isDark = theme === 'dark';
                            const overlayColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';
                            root.style.setProperty('--background-overlay', `oklch(${overlayColor} / ${newOpacity})`);
                          }}
                          min={0}
                          max={100}
                          step={5}
                          gradient={`linear-gradient(to right, transparent, ${oklchToHex(backgroundOklch)})`}
                        />
                        <p className="text-xs text-muted-foreground">
                          Adjust how much the background color overlays the image
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="wewrite-card bg-muted/30 border-dashed border-2 border-muted-foreground/20">
                    <div className="p-6 text-center space-y-3">
                      <div className="text-muted-foreground">
                        <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      </div>
                      <h3 className="font-medium text-foreground">Custom Background Images</h3>
                      <p className="text-sm text-muted-foreground">
                        Unlock custom background images by starting your subscription
                      </p>
                      <Button
                        onClick={() => window.location.href = '/settings/subscription'}
                        className="mt-4"
                      >
                        Start Subscription
                      </Button>
                    </div>
                  </div>
                )}

                {/* Switch back to uploaded image button - only show if we have an uploaded image and are currently using solid color */}
                {hasActiveSubscription && lastUploadedImage && background.type === 'solid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={switchToUploadedImage}
                    className="w-full"
                  >
                    Switch to Uploaded Image
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SegmentedControlContent>
      </SegmentedControl>

      {/* Background Blur Slider - show for both tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Background Blur</label>
          <span className="text-sm text-muted-foreground">
            {Math.round(backgroundBlur * 100)}%
          </span>
        </div>
        <ColorSlider
          value={backgroundBlur * 100}
          onChange={(value) => setBackgroundBlur(value / 100)}
          min={0}
          max={100}
          step={5}
          gradient="linear-gradient(to right, transparent, rgba(255, 255, 255, 0.5))"
        />
        <p className="text-xs text-muted-foreground">
          Add blur effect to the background (0-20px blur)
        </p>
      </div>
    </div>
  );
}
