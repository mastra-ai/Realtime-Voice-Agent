import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'wa-header': '#075E54',
        'wa-teal': '#128C7E',
        'wa-light': '#F0F2F5',
        'wa-bg': '#E5DDD5',
        'wa-outgoing': '#DCF8C6',
        'wa-incoming': '#FFFFFF',
        'wa-text': '#111B21',
        'wa-secondary': '#667781',
        'wa-border': '#D1D7DB',
        'wa-red': '#DC3545',
        'wa-icon': '#54656F',
      },
      animation: {
        'pulse-gentle': 'pulse-gentle 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'wa': '0 1px 0.5px rgba(11, 20, 26, 0.13)',
        'header': '0 4px 8px rgba(0, 0, 0, 0.1)',
        'footer': '0 -1px 4px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
