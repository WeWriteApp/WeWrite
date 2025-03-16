/**
 * Tailwind Configuration
 * 
 * IMPORTANT THEME HANDLING REQUIREMENTS:
 * 1. Use CSS variables from globals.css for theme-specific colors
 * 2. Avoid hardcoding colors here - use CSS variables instead
 * 3. All new color definitions should support both light and dark modes
 * 4. System theme preferences should be handled by ThemeProvider, not CSS
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      // Use CSS variables for theme-dependent colors
      backgroundColor: {
        'background': 'var(--background-color)',
        'background-light': 'var(--light-background-color)',
        'primary': 'var(--primary-color)',
        'secondary': 'var(--secondary-color)',
        'reactangle': '#FFFFFF1F',
        'active-bar': '#0083FD',
        'gray-bar': '#FFFFFF5E'
      },
      textColor: {
        'primary': 'var(--primary-color)',
        'secondary': 'var(--secondary-color)',
        'text': 'var(--text-color)',
        'button': 'var(--button-text)'
      },
      borderColor: {
        'border': 'var(--border-color)',
        'primary': 'var(--primary-color)',
      },
      width: {
        'action-button': '50px',
      },
      height: {
        'action-button': '50px',
        'fill': '-webkit-fill-available'
      },
      borderRadius: {
        'pledge': '21px'
      },
      inset: {
        '95': '95px'
      },
      colors: {
        'gray': '#FFFFFF5E',
        'gray-30': '#FFFFFF4D',
        'gray-46': '#FFFFFF75'
      },
      fontFamily: {
        Helvetica: ['Helvetica', 'sans-serif']
      },
    },
  },
  plugins: [],
};
export default config;
