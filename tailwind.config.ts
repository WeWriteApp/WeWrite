/**
 * Tailwind Configuration
 *
 * IMPORTANT THEME HANDLING REQUIREMENTS:
 * 1. Use CSS variables from globals.css for theme-specific colors
 * 2. Avoid hardcoding colors here - use CSS variables instead
 * 3. All new color definitions should support both light and dark modes
 * 4. System theme preferences should be handled by ThemeProvider, not CSS
 *
 * COLOR FORMAT MAPPING (CRITICAL - DO NOT MIX UP):
 * - HSL format variables (use hsl() wrapper):
 *   border, input, background, foreground, card, popover, secondary, muted, accent
 * - OKLCH format variables (use oklch() wrapper):
 *   ring, primary, neutral, error, success, warning
 */

import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // HSL format colors (from globals.css)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // OKLCH format colors (primary accent uses oklch for perceptual uniformity)
        ring: "oklch(var(--ring))",
        // Alpha overlay colors - use black in light mode, white in dark mode
        // These are meant to be layered ON TOP of other colors for hover/active states
        alpha: {
          5: "var(--alpha-5)",
          10: "var(--alpha-10)",
          15: "var(--alpha-15)",
          20: "var(--alpha-20)",
          25: "var(--alpha-25)",
          30: "var(--alpha-30)",
        },
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
          5: "oklch(var(--primary) / 0.05)",
          10: "oklch(var(--primary) / 0.10)",
          15: "oklch(var(--primary) / 0.15)",
          20: "oklch(var(--primary) / 0.20)",
          30: "oklch(var(--primary) / 0.30)",
          40: "oklch(var(--primary) / 0.40)",
          50: "oklch(var(--primary) / 0.50)",
          60: "oklch(var(--primary) / 0.60)",
          70: "oklch(var(--primary) / 0.70)",
          80: "oklch(var(--primary) / 0.80)",
          90: "oklch(var(--primary) / 0.90)",
        },
        // HSL format UI colors
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        neutral: {
          DEFAULT: "oklch(var(--neutral))",
          foreground: "oklch(var(--neutral-foreground))",
          5: "oklch(var(--neutral) / 0.05)",
          10: "oklch(var(--neutral) / 0.10)",
          15: "oklch(var(--neutral) / 0.15)",
          20: "oklch(var(--neutral) / 0.20)",
          25: "oklch(var(--neutral) / 0.25)",
          30: "oklch(var(--neutral) / 0.30)",
          40: "oklch(var(--neutral) / 0.40)",
          50: "oklch(var(--neutral) / 0.50)",
          60: "oklch(var(--neutral) / 0.60)",
          70: "oklch(var(--neutral) / 0.70)",
          80: "oklch(var(--neutral) / 0.80)",
          90: "oklch(var(--neutral) / 0.90)",
        },
        // OKLCH Semantic Colors with Opacity Variations
        error: {
          DEFAULT: "oklch(var(--error))",
          foreground: "oklch(var(--error-foreground))",
          10: "oklch(var(--error) / 0.10)",
          20: "oklch(var(--error) / 0.20)",
          30: "oklch(var(--error) / 0.30)",
          40: "oklch(var(--error) / 0.40)",
          50: "oklch(var(--error) / 0.50)",
          60: "oklch(var(--error) / 0.60)",
          70: "oklch(var(--error) / 0.70)",
          80: "oklch(var(--error) / 0.80)",
          90: "oklch(var(--error) / 0.90)",
        },
        success: {
          DEFAULT: "oklch(var(--success))",
          foreground: "oklch(var(--success-foreground))",
          10: "oklch(var(--success) / 0.10)",
          20: "oklch(var(--success) / 0.20)",
          30: "oklch(var(--success) / 0.30)",
          40: "oklch(var(--success) / 0.40)",
          50: "oklch(var(--success) / 0.50)",
          60: "oklch(var(--success) / 0.60)",
          70: "oklch(var(--success) / 0.70)",
          80: "oklch(var(--success) / 0.80)",
          90: "oklch(var(--success) / 0.90)",
        },
        warning: {
          DEFAULT: "oklch(var(--warning))",
          foreground: "oklch(var(--warning-foreground))",
          10: "oklch(var(--warning) / 0.10)",
          20: "oklch(var(--warning) / 0.20)",
          30: "oklch(var(--warning) / 0.30)",
          40: "oklch(var(--warning) / 0.40)",
          50: "oklch(var(--warning) / 0.50)",
          60: "oklch(var(--warning) / 0.60)",
          70: "oklch(var(--warning) / 0.70)",
          80: "oklch(var(--warning) / 0.80)",
          90: "oklch(var(--warning) / 0.90)",
        },
        // Legacy aliases for compatibility (uses OKLCH - same as error)
        destructive: {
          DEFAULT: "oklch(var(--error))",
          foreground: "oklch(var(--error-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          10: "hsl(var(--accent) / 0.10)",
          20: "hsl(var(--accent) / 0.20)",
          30: "hsl(var(--accent) / 0.30)",
          40: "hsl(var(--accent) / 0.40)",
          50: "hsl(var(--accent) / 0.50)",
          60: "hsl(var(--accent) / 0.60)",
          70: "hsl(var(--accent) / 0.70)",
          80: "hsl(var(--accent) / 0.80)",
          90: "hsl(var(--accent) / 0.90)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      // Removed custom colors in favor of Radix colors
      width: {
        'action-button': '50px',
      },
      height: {
        'action-button': '50px',
        'fill': '-webkit-fill-available'
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'pledge': '21px'
      },
      inset: {
        '1/10': '10%',
        '2/10': '20%',
        '3/10': '30%',
        '4/10': '40%',
        '6/10': '60%',
        '7/10': '70%',
        '8/10': '80%',
        '9/10': '90%',
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
        'gradient': 'gradient 3s ease infinite',
        'fadeIn': 'fadeIn 0.5s ease-in-out forwards',
        'fadeInSlow': 'fadeIn 0.8s ease-in-out forwards',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'gradient': {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
        'fadeIn': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'collapsible-down': {
          '0%': { height: '0' },
          '100%': { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          '0%': { height: 'var(--radix-collapsible-content-height)' },
          '100%': { height: '0' },
        },
      },
    },
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    })
  ],
}

export default config;
