/**
 * Tailwind Configuration
 *
 * IMPORTANT: ALL colors use OKLCH format exclusively.
 * CSS variables in globals.css are defined as: L C H (e.g., "0.50 0.25 230")
 * Use oklch(var(--variable)) wrapper for all color references.
 */

import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Safelist dynamically generated classes that might be purged
  safelist: [
    '!text-white',
    '!text-black',
    'z-[1200]', // Tooltip z-index (above drawers at z-[1100])
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════════════════
        // OKLCH COLOR SYSTEM - All colors use oklch() wrapper
        // ═══════════════════════════════════════════════════════════════════

        // Base colors
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        ring: "oklch(var(--ring))",

        // Alpha overlay colors (rgba for layering)
        alpha: {
          5: "var(--alpha-5)",
          10: "var(--alpha-10)",
          15: "var(--alpha-15)",
          20: "var(--alpha-20)",
          25: "var(--alpha-25)",
          30: "var(--alpha-30)",
        },

        // Primary - dynamic accent color
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

        // Secondary - UI backgrounds
        secondary: {
          DEFAULT: "oklch(var(--secondary))",
          foreground: "oklch(var(--secondary-foreground))",
        },

        // Neutral - for badges and chips
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

        // Semantic colors
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

        // Aliases for compatibility
        destructive: {
          DEFAULT: "oklch(var(--destructive))",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted))",
          foreground: "oklch(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "oklch(var(--accent))",
          foreground: "oklch(var(--accent-foreground))",
          10: "oklch(var(--accent) / 0.10)",
          20: "oklch(var(--accent) / 0.20)",
          30: "oklch(var(--accent) / 0.30)",
          40: "oklch(var(--accent) / 0.40)",
          50: "oklch(var(--accent) / 0.50)",
          60: "oklch(var(--accent) / 0.60)",
          70: "oklch(var(--accent) / 0.70)",
          80: "oklch(var(--accent) / 0.80)",
          90: "oklch(var(--accent) / 0.90)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
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
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-up-fade': 'slide-up-fade 0.3s ease-out forwards',
        'dialog-in': 'dialog-in 0.2s ease-out forwards',
        'dialog-out': 'dialog-out 0.15s ease-in forwards',
        // Element reveal animations for smooth layout shifts
        'reveal-in': 'reveal-in 0.25s ease-out forwards',
        'reveal-out': 'reveal-out 0.2s ease-in forwards',
        'reveal-scale-in': 'reveal-scale-in 0.25s ease-out forwards',
        'reveal-scale-out': 'reveal-scale-out 0.2s ease-in forwards',
        // Drawer animations
        'drawer-slide-up': 'drawer-slide-up 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'drawer-slide-down': 'drawer-slide-down 0.3s ease-out forwards',
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
        'accordion-down': {
          '0%': { height: '0' },
          '100%': { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          '0%': { height: 'var(--radix-accordion-content-height)' },
          '100%': { height: '0' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'dialog-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'dialog-out': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
        },
        // Drawer animations (bottom sheet style with subtle bounce)
        'drawer-slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '70%': { transform: 'translateY(-2%)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'drawer-slide-down': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        // Element reveal animations - for smooth appearance of new elements
        'reveal-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(4px)' },
        },
        'reveal-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'reveal-scale-out': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
        },
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
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
