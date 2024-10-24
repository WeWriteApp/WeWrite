import type { Config } from "tailwindcss";
const {nextui} = require("@nextui-org/react");
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
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
        'gray-46': '#FFFFFF75',
        dark:{
          DEFAULT:"#272727",
          100:"#2d2d2d",
          400:"#161616"
        }
      },
      fontFamily: {
        Helvetica: ['Helvetica', 'sans-serif']
      },
    },
  },
  plugins: [nextui()],
};
export default config;
