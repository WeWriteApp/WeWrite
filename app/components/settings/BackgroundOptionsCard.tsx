"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../providers/ThemeProvider';
import { useAppBackground, type ImageBackground } from '../../contexts/AppBackgroundContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../ui/segmented-control';
import { Button } from '../ui/button';
import { Lock, Palette, Image as ImageIcon, Loader } from 'lucide-react';
import OKLCHColorSlider from './OKLCHColorSlider';
import ColorSlider from './ColorSlider';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import { oklchToHex } from '../../lib/oklch-utils';

interface DefaultBackgroundImage {
  id: string;
  filename: string;
  url: string;
  order: number;
  active: boolean;
}

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

  // State for default background images
  const [defaultImages, setDefaultImages] = useState<DefaultBackgroundImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);

  // State for user's uploaded background image
  const [userUploadedImage, setUserUploadedImage] = useState<string | null>(null);
  const [backgroundDataLoading, setBackgroundDataLoading] = useState(true);

  // Track previous backgrounds for switching
  const [previousColorBackground, setPreviousColorBackground] = useState(
    background.type === 'solid' ? background : {
      type: 'solid' as const,
      color: '#ffffff',
      darkColor: '#000000',
      oklchLight: '98.22% 0.0061 255.5',
      oklchDark: '0.00% 0.0000 0.0'
    }
  );
  const [previousImageBackground, setPreviousImageBackground] = useState<ImageBackground | null>(
    background.type === 'image' ? background : null
  );

  // Fetch user's background preference data
  useEffect(() => {
    const fetchBackgroundData = async () => {
      try {
        const response = await fetch('/api/user/background-preference', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[BackgroundOptionsCard] Fetched background data:', data);

          // Set the uploaded image if it exists
          if (data.backgroundImage?.url) {
            setUserUploadedImage(data.backgroundImage.url);
            console.log('[BackgroundOptionsCard] Found uploaded image:', data.backgroundImage.url);
          }
        } else {
          console.error('Failed to fetch background preference:', response.status);
        }
      } catch (error) {
        console.error('Error fetching background preference:', error);
      } finally {
        setBackgroundDataLoading(false);
      }
    };

    fetchBackgroundData();
  }, []);

  // Fetch default background images
  useEffect(() => {
    const fetchDefaultImages = async () => {
      try {
        const response = await fetch('/api/background-images');
        const data = await response.json();

        if (data.success) {
          setDefaultImages(data.images);
        } else {
          console.error('Failed to fetch default background images:', data.error);
        }
      } catch (error) {
        console.error('Error fetching default background images:', error);
      } finally {
        setImagesLoading(false);
      }
    };

    fetchDefaultImages();
  }, []);

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
    setPreviousColorBackground(newBackground);
  };

  const switchToUploadedImage = () => {
    if (lastUploadedImage) {
      const imageBackground: ImageBackground = {
        type: 'image',
        url: lastUploadedImage,
        opacity: 0.15
      };
      setBackground(imageBackground);
      setPreviousImageBackground(imageBackground);
      setActiveTab('image');
    }
  };

  const handleDefaultImageSelect = (imageUrl: string) => {
    const imageBackground: ImageBackground = {
      type: 'image',
      url: imageUrl,
      opacity: 0.15
    };
    setBackground(imageBackground);
    setPreviousImageBackground(imageBackground);
  };

  // Handle tab switching - actually switch backgrounds
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);

    if (newTab === 'color') {
      // Switch to color background
      if (background.type === 'image') {
        setPreviousImageBackground(background);
      }
      setBackground(previousColorBackground);
    } else if (newTab === 'image') {
      // Switch to image background
      if (background.type === 'solid') {
        setPreviousColorBackground(background);
      }

      // Use previous image background if available, otherwise try uploaded images
      if (previousImageBackground) {
        setBackground(previousImageBackground);
      } else if (lastUploadedImage || userUploadedImage) {
        // Prefer the most recent uploaded image
        const imageUrl = lastUploadedImage || userUploadedImage;
        const imageBackground: ImageBackground = {
          type: 'image',
          url: imageUrl,
          opacity: 0.15
        };
        setBackground(imageBackground);
        setPreviousImageBackground(imageBackground);
      }
      // If no previous image and no uploaded image, just show the tab (user can select a default image)
    }
  };

  return (
    <div className="space-y-4">
      {/* Segmented Control for Color/Image */}
      <SegmentedControl value={activeTab} onValueChange={handleTabChange}>
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
            <div className="mb-4">
              {imagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading backgrounds...</span>
                </div>
              ) : defaultImages.length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No default backgrounds available</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {defaultImages.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => handleDefaultImageSelect(image.url)}
                      className={`aspect-video rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                        background.type === 'image' && background.url === image.url
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-muted-foreground/25 hover:border-muted-foreground/40'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Upload Section */}
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Upload</label>
              <div className="space-y-3">
                {hasActiveSubscription ? (
                  <>
                    <BackgroundImageUpload
                      persistedImageUrl={userUploadedImage}
                      isLoading={backgroundDataLoading}
                    />

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
                    variant="secondary"
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
