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
      backgroundColor: {
        'reactangle': '#FFFFFF1F',
        'active-bar': '#0083FD',
        'gray-bar': '#FFFFFF5E'
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
