/** @type {import('tailwindcss').Config} */
export default {
  // Prefix all Tailwind utilities with 'ap-' to avoid theme conflicts
  prefix: 'ap-',
  
  // Use selector strategy - Tailwind wins inside #root, but NOT inside .excalidraw
  important: '#root',
  
  // Ensure dark mode is disabled
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  theme: {
    extend: {
      colors: {
        // TailAdmin Color Palette
        brand: {
          50: '#ecf3ff',
          100: '#dde9ff',
          200: '#c2d6ff',
          300: '#9cb9ff',
          400: '#7592ff',
          500: '#465fff',
          600: '#3641f5',
          700: '#2a31d8',
          800: '#1f25b0',
          900: '#1a1f8a',
        },
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#6ce9a6',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
          800: '#05603a',
          900: '#054f31',
        },
        error: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          300: '#fda29b',
          400: '#f97066',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
          800: '#912018',
          900: '#7a271a',
        },
        warning: {
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fedf89',
          300: '#fec84b',
          400: '#fdb022',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
          800: '#93370d',
          900: '#7a2e0e',
        },
        // AquaticPro brand colors (preserved for existing usage)
        aqua: {
          blue: '#0004ff',
          sky: '#12a4ff',
          purple: '#9f0fff',
          pink: '#f538f2',
        },
        // Lavender palette for sidebar navigation
        lavender: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },
      backgroundImage: {
        // Primary gradient
        'gradient-aqua': 'linear-gradient(90deg, #0004ff, #12a4ff, #9f0fff, #f538f2)',
        'gradient-aqua-r': 'linear-gradient(90deg, #f538f2, #9f0fff, #12a4ff, #0004ff)',
        // Hover variants
        'gradient-aqua-hover': 'linear-gradient(90deg, #0004ff, #12a4ff, #9f0fff, #f538f2)',
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
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
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}