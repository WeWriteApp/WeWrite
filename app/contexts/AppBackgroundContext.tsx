"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { useSubscription } from './SubscriptionContext';
import { hexToOklch, formatOklchForCSSVar } from '../lib/oklch-utils';

// Background types
export type BackgroundType = 'solid' | 'image';

export interface SolidBackground {
  type: 'solid';
  color: string; // hex color
  darkColor?: string; // optional dark mode color
  oklchLight?: string; // OKLCH representation for light mode
  oklchDark?: string; // OKLCH representation for dark mode
}

export interface ImageBackground {
  type: 'image';
  url: string; // image URL
  opacity?: number; // card opacity (0-1)
}

export type AppBackground = SolidBackground | ImageBackground;

// Default backgrounds with theme-aware colors
const DEFAULT_SOLID_BACKGROUNDS: SolidBackground[] = [
  {
    type: 'solid',
    color: '#ffffff',
    darkColor: '#000000',
    oklchLight: '100.00% 0.0000 158.2',
    oklchDark: '0.00% 0.0000 0.0'
  }, // Pure white / Pure black (DEFAULT)
  {
    type: 'solid',
    color: '#f8fafc',
    darkColor: '#0f172a',
    oklchLight: '98.18% 0.0123 255.6',
    oklchDark: '7.96% 0.1445 283.3'
  }, // Light grey / Dark slate
  {
    type: 'solid',
    color: '#f1f5f9',
    darkColor: '#1e293b',
    oklchLight: '96.35% 0.0246 255.8',
    oklchDark: '16.39% 0.1306 274.7'
  }, // Slate 100 / Slate 800
  {
    type: 'solid',
    color: '#f0f9ff',
    darkColor: '#0c4a6e',
    oklchLight: '97.43% 0.0431 244.5',
    oklchDark: '29.67% 0.2639 260.3'
  }, // Sky 50 / Sky 900
  {
    type: 'solid',
    color: '#fefce8',
    darkColor: '#713f12',
    oklchLight: '95.70% 0.2280 97.9',
    oklchDark: '30.82% 0.4476 52.9'
  }, // Yellow 50 / Yellow 900
  {
    type: 'solid',
    color: '#f0fdf4',
    darkColor: '#14532d',
    oklchLight: '97.90% 0.0725 164.7',
    oklchDark: '28.91% 0.2642 168.0'
  }, // Green 50 / Green 900
  {
    type: 'solid',
    color: '#fdf2f8',
    darkColor: '#831843',
    oklchLight: '93.59% 0.0971 340.6',
    oklchDark: '29.12% 0.4700 2.7'
  }, // Pink 50 / Pink 900
  {
    type: 'solid',
    color: '#f5f3ff',
    darkColor: '#4c1d95',
    oklchLight: '96.30% 0.0619 297.1',
    oklchDark: '25.52% 0.7417 309.9'
  }, // Violet 50 / Violet 900
];

interface AppBackgroundContextType {
  background: AppBackground;
  setBackground: (background: AppBackground) => void;
  defaultSolidBackgrounds: SolidBackground[];
  cardOpacity: number;
  setCardOpacity: (opacity: number) => void;
  cardBlur: number;
  setCardBlur: (blur: number) => void;
  backgroundBlur: number;
  setBackgroundBlur: (blur: number) => void;
  resetToDefault: () => void;
  // Persistent image storage - keeps last uploaded image even when using solid colors
  lastUploadedImage: string | null;
  setLastUploadedImage: (url: string | null) => void;
}

const DEFAULT_BACKGROUND: SolidBackground = {
  type: 'solid',
  color: '#ffffff',
  darkColor: '#000000',
  oklchLight: '100.00% 0.0000 158.2',
  oklchDark: '0.00% 0.0000 0.0'
};

const AppBackgroundContext = createContext<AppBackgroundContextType>({
  background: DEFAULT_BACKGROUND,
  setBackground: () => {},
  defaultSolidBackgrounds: DEFAULT_SOLID_BACKGROUNDS,
  cardOpacity: 0.15, // 15% opacity - within 0-20% range
  setCardOpacity: () => {},
  cardBlur: 0.5, // 50% blur - within 0-1 range
  setCardBlur: () => {},
  backgroundBlur: 0.0, // 0% background blur by default
  setBackgroundBlur: () => {},
  resetToDefault: () => {},
  lastUploadedImage: null,
  setLastUploadedImage: () => {}
});

export function AppBackgroundProvider({ children }: { children: React.ReactNode }) {
  const [background, setBackground] = useState<AppBackground>(DEFAULT_BACKGROUND);
  const [cardOpacity, setCardOpacity] = useState(0.15); // Default 15% opacity - within 0-20% range
  const [cardBlur, setCardBlur] = useState(0.5); // Default 50% blur - within 0-1 range
  const [backgroundBlur, setBackgroundBlur] = useState(0.0); // Default 0% background blur
  const [lastUploadedImage, setLastUploadedImage] = useState<string | null>(null);
  const { theme, resolvedTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper function to check if an image URL is a default background (always allowed)
  // vs a custom uploaded image (requires subscription)
  const isDefaultBackgroundImage = (url: string): boolean => {
    return url.includes('/backgrounds/defaults/') || url.includes('default-bg-');
  };

  // Ref to store the debounce timeout
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track which user we've loaded background for (prevents duplicate loads)
  const loadedForUserRef = useRef<string | null>(null);

  // Load background settings from database for authenticated users, localStorage for others
  useEffect(() => {
    const loadBackgroundSettings = async () => {
      try {
        if (isAuthenticated && user?.uid) {
          // Only load from database if we haven't already loaded for this user
          // This prevents re-loading and potentially resetting the background during auth state changes
          const currentUserId = user.uid;

          // Skip if we've already loaded for this user
          if (loadedForUserRef.current === currentUserId) {
            // Still ensure the background is applied to DOM in case it was cleared
            if (background.type !== 'solid' || background.color !== DEFAULT_BACKGROUND.color) {
              applyBackgroundToDOM(background, cardOpacity, resolvedTheme || 'light');
            }
            return;
          }

          // Load from database for authenticated users
          try {
            console.log('[AppBackground] Fetching background preference for user:', currentUserId);
            const response = await fetch('/api/user/background-preference', {
              method: 'GET',
              credentials: 'include'
            });

            console.log('[AppBackground] API response status:', response.status);
            if (response.ok) {
              const data = await response.json();
              console.log('[AppBackground] API response data:', data);

              // Always store the uploaded image if it exists
              if (data.backgroundImage?.url) {
                console.log('[AppBackground] Found uploaded image:', data.backgroundImage.url);
                setLastUploadedImage(data.backgroundImage.url);
              } else {
                console.log('[AppBackground] No uploaded image found');
              }

              // Apply the user's preference (solid color or image)
              if (data.backgroundPreference) {
                console.log('[AppBackground] Found background preference:', data.backgroundPreference);
                if (data.backgroundPreference.type === 'image' && data.backgroundPreference.data) {
                  const imageUrl = data.backgroundPreference.data.url;
                  // Allow default background images even without subscription, but require subscription for custom uploads
                  if (hasActiveSubscription || isDefaultBackgroundImage(imageUrl)) {
                    // Use the saved preference data directly, which contains the full image background object
                    setBackground(data.backgroundPreference.data);
                    console.log('[AppBackground] Loaded image background from preference:', imageUrl);
                  } else {
                    // User doesn't have active subscription and it's a custom image, fall back to default solid background
                    console.log('[AppBackground] Custom image background blocked - no active subscription');
                    setBackground(DEFAULT_BACKGROUND);
                  }
                } else if (data.backgroundPreference.type === 'solid' && data.backgroundPreference.data) {
                  setBackground(data.backgroundPreference.data);
                  console.log('[AppBackground] Loaded solid background from preference');
                }
              } else if (data.backgroundImage?.url) {
                // Fallback: if no preference but image exists, check subscription before using
                const imageUrl = data.backgroundImage.url;
                if (hasActiveSubscription || isDefaultBackgroundImage(imageUrl)) {
                  const imageBackground: ImageBackground = {
                    type: 'image',
                    url: imageUrl,
                    opacity: 0.15
                  };
                  setBackground(imageBackground);
                  console.log('[AppBackground] Loaded image background from fallback, saving as preference:', imageUrl);
                } else {
                  // User doesn't have active subscription and it's a custom image, use default background
                  console.log('[AppBackground] Custom image background blocked - no active subscription');
                  setBackground(DEFAULT_BACKGROUND);
                }

                // Save this as the user's preference for future sessions
                try {
                  await fetch('/api/user/background-preference', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                      backgroundType: 'image',
                      backgroundData: imageBackground
                    })
                  });
                } catch (error) {
                  console.warn('[AppBackground] Failed to save fallback preference:', error);
                }
              }

              // Mark that we've loaded for this user
              loadedForUserRef.current = currentUserId;
            }
          } catch (error) {
            console.warn('Failed to load background from database:', error);
          }
        } else if (!isAuthenticated && isInitialized) {
          // Reset the loaded user ref when user logs out
          loadedForUserRef.current = null;

          // Only load from localStorage for explicitly non-authenticated users after initialization
          // This prevents loading localStorage data during the authentication loading phase
          const savedBackground = localStorage.getItem('app-background');
          if (savedBackground) {
            const parsedBackground = JSON.parse(savedBackground) as AppBackground;
            setBackground(parsedBackground);
          }
        }

        // Always load card opacity and blur from localStorage
        const savedOpacity = localStorage.getItem('card-opacity');
        if (savedOpacity) {
          const opacity = parseFloat(savedOpacity);
          setCardOpacity(opacity);
        }

        const savedBlur = localStorage.getItem('card-blur');
        if (savedBlur) {
          const blur = parseFloat(savedBlur);
          setCardBlur(blur);
        }

        const savedBackgroundBlur = localStorage.getItem('background-blur');
        if (savedBackgroundBlur) {
          const blur = parseFloat(savedBackgroundBlur);
          setBackgroundBlur(blur);
        }

        setIsInitialized(true);
      } catch (error) {
        console.warn('Failed to load saved settings:', error);
        setIsInitialized(true);
      }
    };

    loadBackgroundSettings();
  }, [isAuthenticated, user?.uid]);

  // Function to save background preference to database
  const saveBackgroundPreference = async (backgroundData: AppBackground) => {
    if (!isAuthenticated || !user?.uid) return;

    // Validate background data before saving
    if (!backgroundData || !backgroundData.type) {
      console.warn('Invalid background data, skipping save');
      return;
    }

    try {
      const response = await fetch('/api/user/background-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          backgroundType: backgroundData.type,
          backgroundData: backgroundData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to save background preference`);
      }
    } catch (error) {
      console.warn('Failed to save background preference:', error);
      // Don't re-throw the error to prevent unhandled promise rejections
    }
  };

  // Apply background when theme or background settings change (NOT card opacity)
  useEffect(() => {
    if (!isInitialized || !resolvedTheme) return;

    // Apply background immediately for visual feedback
    applyBackgroundToDOM(background, cardOpacity, resolvedTheme);

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save operation to prevent excessive API calls
    saveTimeoutRef.current = setTimeout(() => {
      const saveBackground = async () => {
        try {
          if (isAuthenticated) {
            // Save to database for authenticated users (debounced)
            await saveBackgroundPreference(background);
          } else {
            // Save to localStorage for non-authenticated users
            localStorage.setItem('app-background', JSON.stringify(background));
          }
        } catch (error) {
          console.warn('Failed to save background settings:', error);
        }
      };

      saveBackground().catch(error => {
        console.warn('Failed to save background (debounced):', error);
      });
    }, 500); // 500ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [background, resolvedTheme, isInitialized, isAuthenticated]);

  // Handle card opacity changes separately to avoid triggering background changes
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem('card-opacity', cardOpacity.toString());
      // Only update the card opacity CSS variable, don't re-apply entire background
      const root = document.documentElement;
      root.style.setProperty('--card-opacity', cardOpacity.toString());
    } catch (error) {
      console.warn('Failed to save card opacity:', error);
    }
  }, [cardOpacity, isInitialized]);

  // Handle card blur changes separately to avoid triggering background changes
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem('card-blur', cardBlur.toString());
      // Update the card blur CSS variable
      const root = document.documentElement;
      root.style.setProperty('--card-blur', cardBlur.toString());
    } catch (error) {
      console.warn('Failed to save card blur:', error);
    }
  }, [cardBlur, isInitialized]);

  // Handle background blur changes
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem('background-blur', backgroundBlur.toString());
      // Update the background blur CSS variable
      const root = document.documentElement;
      root.style.setProperty('--background-blur', `${backgroundBlur * 20}px`); // Scale 0-1 to 0-20px
    } catch (error) {
      console.warn('Failed to save background blur:', error);
    }
  }, [backgroundBlur, isInitialized]);

  // Force re-apply background when theme changes (additional safety)
  useEffect(() => {
    if (!isInitialized || !resolvedTheme) return;

    // Small delay to ensure theme has been applied to DOM
    const timeoutId = setTimeout(() => {
      applyBackgroundToDOM(background, cardOpacity, resolvedTheme);
      // Also re-apply card opacity and blur after theme change
      const root = document.documentElement;
      root.style.setProperty('--card-opacity', cardOpacity.toString());
      root.style.setProperty('--card-blur', cardBlur.toString());
      root.style.setProperty('--background-blur', `${backgroundBlur * 20}px`);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [resolvedTheme]);

  // Additional safeguard: Re-apply background on navigation/page changes
  useEffect(() => {
    if (!isInitialized || !resolvedTheme) return;

    // Check if background image CSS variable is missing and re-apply if needed
    const checkAndReapplyBackground = () => {
      const root = document.documentElement;
      const currentBgImage = root.style.getPropertyValue('--background-image');

      // If we have an image background but the CSS variable is missing, re-apply
      if (background.type === 'image' && background.url && !currentBgImage) {
        console.log('Background image CSS variable missing, re-applying...');
        applyBackgroundToDOM(background, cardOpacity, resolvedTheme);
      }
    };

    // Check immediately and also after a short delay
    checkAndReapplyBackground();
    const timeoutId = setTimeout(checkAndReapplyBackground, 500);

    return () => clearTimeout(timeoutId);
  }, [background, cardOpacity, backgroundBlur, resolvedTheme, isInitialized]);

  // Handle subscription changes - reset to default if subscription expires and user has custom image background
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // If user doesn't have active subscription and is currently using a custom image background
    // (but allow default background images to continue working)
    if (!hasActiveSubscription && background.type === 'image' && !isDefaultBackgroundImage(background.url)) {
      console.log('[AppBackground] Subscription expired, resetting custom image background to default');
      setBackground(DEFAULT_BACKGROUND);
    }
  }, [hasActiveSubscription, background.type, background, isInitialized, isAuthenticated]);

  const resetToDefault = () => {
    setBackground(DEFAULT_BACKGROUND);
    setCardOpacity(0.15); // Reset to 15% opacity
    setCardBlur(0.5); // Reset to 50% blur
    setBackgroundBlur(0.0); // Reset to 0% background blur
  };

  return (
    <AppBackgroundContext.Provider value={{
      background,
      setBackground,
      defaultSolidBackgrounds: DEFAULT_SOLID_BACKGROUNDS,
      cardOpacity,
      setCardOpacity,
      cardBlur,
      setCardBlur,
      backgroundBlur,
      setBackgroundBlur,
      resetToDefault,
      lastUploadedImage,
      setLastUploadedImage
    }}>
      {children}
    </AppBackgroundContext.Provider>
  );
}

export const useAppBackground = () => {
  const context = useContext(AppBackgroundContext);
  if (!context) {
    throw new Error('useAppBackground must be used within AppBackgroundProvider');
  }
  return context;
};

// Helper function to update overlay opacity immediately
function updateOverlayOpacity(background: AppBackground, theme: string) {
  if (background.type !== 'image') return;

  const root = document.documentElement;
  const overlayOpacity = background.opacity || 0.15;
  const isDark = theme === 'dark';
  const overlayColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';

  root.style.setProperty('--background-overlay', `oklch(${overlayColor} / ${overlayOpacity})`);
  console.log('Updated overlay opacity to:', overlayOpacity, 'with color:', overlayColor);
}

// Helper function to apply background to DOM with theme awareness
function applyBackgroundToDOM(background: AppBackground, cardOpacity: number, theme: string) {
  const root = document.documentElement;

  // Note: Card opacity is now handled separately to avoid triggering background changes

  if (background.type === 'solid') {
    // Use the resolved theme from next-themes
    const isDark = theme === 'dark';

    // Use pre-computed OKLCH values if available, otherwise convert hex
    let oklchValue: string;
    if (background.oklchLight && background.oklchDark) {
      oklchValue = isDark ? background.oklchDark : background.oklchLight;

      // Safeguard: prevent black background in light mode
      if (!isDark && oklchValue.startsWith('0.00%')) {
        console.warn('Preventing black background in light mode, using default');
        oklchValue = '98.22% 0.0061 255.5'; // Default light background
      }

      // Safeguard: prevent white background in dark mode
      if (isDark && (oklchValue.startsWith('100.00%') || oklchValue.startsWith('98.') || oklchValue.startsWith('99.'))) {
        console.warn('Preventing white background in dark mode, using default');
        oklchValue = '0.00% 0.0000 0.0'; // Default dark background
      }
    } else {
      // Fallback to hex conversion
      const color = isDark && background.darkColor ? background.darkColor : background.color;

      // Safeguards: prevent inappropriate colors for each theme
      if (!isDark && (color === '#000000' || color.includes('0.00%'))) {
        console.warn('Preventing black background in light mode, using default');
        oklchValue = '98.22% 0.0061 255.5'; // Default light background
      } else if (isDark && (color === '#ffffff' || color === '#FFFFFF' || color.includes('100.00%') || color.includes('98.') || color.includes('99.'))) {
        console.warn('Preventing white background in dark mode, using default');
        oklchValue = '0.00% 0.0000 0.0'; // Default dark background
      } else {
        const oklch = hexToOklch(color);
        oklchValue = oklch ? formatOklchForCSSVar(oklch) : (isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5');
      }
    }

    root.style.setProperty('--background', oklchValue);
    root.style.setProperty('--background-image', 'none');
    root.style.setProperty('--background-overlay', 'none');

    // Remove class from body to restore normal page container backgrounds
    document.body.classList.remove('has-background-image');
  } else if (background.type === 'image') {
    // For images, set background image and overlay
    if (!background.url) {
      console.warn('Image background has no URL, falling back to solid color');
      root.style.setProperty('--background-image', 'none');
      root.style.setProperty('--background-overlay', 'none');
      // Use theme-appropriate default background
      const isDark = theme === 'dark';
      const defaultColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';
      root.style.setProperty('--background', defaultColor);
      return;
    }

    // Get the overlay opacity (default to 0.15 if not set)
    const overlayOpacity = background.opacity || 0.15;

    // Determine overlay color based on theme
    const isDark = theme === 'dark';
    const overlayColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5'; // Dark or light background

    // Test if the image loads
    const img = new Image();
    img.onload = () => {
      try {
        root.style.setProperty('--background-image', `url("${background.url}")`);
        root.style.setProperty('--background-overlay', `oklch(${overlayColor} / ${overlayOpacity})`);
      } catch (error) {
        console.error('Failed to set background image CSS:', error);
      }
    };
    img.onerror = (event) => {
      console.error('Failed to load background image:', background.url, event);
      // Fallback to solid color if image fails
      try {
        root.style.setProperty('--background-image', 'none');
        root.style.setProperty('--background-overlay', 'none');
        // Use theme-appropriate fallback background
        const fallbackColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';
        root.style.setProperty('--background', fallbackColor);
      } catch (error) {
        console.error('Failed to set fallback background:', error);
      }
    };

    try {
      img.src = background.url;
    } catch (error) {
      console.error('Failed to set image src:', error);
      root.style.setProperty('--background-image', 'none');
      root.style.setProperty('--background-overlay', 'none');
    }

    // Set immediately (optimistic)
    root.style.setProperty('--background-image', `url("${background.url}")`);
    root.style.setProperty('--background-overlay', `oklch(${overlayColor} / ${overlayOpacity})`);

    // Add class to body to make page containers transparent
    document.body.classList.add('has-background-image');

    // Set fallback to theme-appropriate neutral color
    const fallbackColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';
    root.style.setProperty('--background', fallbackColor);
  }
}

// Helper function to convert default solid backgrounds to OKLCH
function convertDefaultBackgroundsToOklch() {
  return DEFAULT_SOLID_BACKGROUNDS.map(bg => {
    const lightOklch = hexToOklch(bg.color);
    const darkOklch = bg.darkColor ? hexToOklch(bg.darkColor) : null;

    return {
      ...bg,
      oklchLight: lightOklch ? formatOklchForCSSVar(lightOklch) : '98.22% 0.0061 255.5',
      oklchDark: darkOklch ? formatOklchForCSSVar(darkOklch) : '0.00% 0.0000 0.0'
    };
  });
}

// Export types and defaults for external use
export { DEFAULT_SOLID_BACKGROUNDS, DEFAULT_BACKGROUND };
