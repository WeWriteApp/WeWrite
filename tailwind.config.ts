import type { Config } from "tailwindcss";
const {nextui} = require("@nextui-org/react");
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
        },
        error:"var(--error)",
        translucent:"var(--translucent)",
        "link-bg":"var(--link-bg)",
        accent:"var(--accent)",
        "link-text":"var(--link-text)",
        text:"var(--text)",
        bg:"var(--background)",
      },
      zIndex:{
        max:"99999"
      },
      fontFamily: {
        Helvetica: ['Helvetica', 'sans-serif']
      },
      scale: {
        101: "1.01",
        99: "0.99"
      },
    },
  },
  plugins: [
    nextui({
      themes: {
        "purple-dark": {
          extend: "dark", // <- inherit default values from dark theme
          colors: {
            background: "#0D001A",
            foreground: "#ffffff",
            primary: {
              50: "#3B096C",
              100: "#520F83",
              200: "#7318A2",
              300: "#9823C2",
              400: "#c031e2",
              500: "#DD62ED",
              600: "#F182F6",
              700: "#FCADF9",
              800: "#FDD5F9",
              900: "#FEECFE",
              DEFAULT: "#DD62ED",
              foreground: "#ffffff",
            },
            focus: "#F182F6",
          },
          layout: {
            disabledOpacity: "0.3",
            radius: {
              small: "4px",
              medium: "6px",
              large: "8px",
            },
            borderWidth: {
              small: "1px",
              medium: "2px",
              large: "3px",
            },
          },
        },
      },
    }),
  ],
};
export default config;
