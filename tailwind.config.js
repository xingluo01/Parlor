/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Parlor brand — rich crimson (CSS variable backed for theming)
        parlor: {
          50: '#fef2f4',
          100: '#fde6ea',
          200: '#fbd0d9',
          300: '#f7a8b8',
          400: 'rgb(var(--parlor-400, 224 64 104) / <alpha-value>)',
          500: 'rgb(var(--parlor-500, 194 51 80) / <alpha-value>)',
          600: 'rgb(var(--parlor-600, 154 40 64) / <alpha-value>)',
          700: '#7a2038',
          800: '#661c30',
          900: '#571a2d',
          950: '#300a14',
        },
        // Burnished gold accent
        accent: {
          300: '#e8cc80',
          400: '#e0bc70',
          500: '#d4a857',
          600: '#c09340',
          700: '#a07a30',
        },
        // Deep noir backgrounds (CSS variable backed for theming)
        dark: {
          50: 'rgb(var(--dark-50, 38 35 48) / <alpha-value>)',
          100: 'rgb(var(--dark-100, 26 24 32) / <alpha-value>)',
          200: 'rgb(var(--dark-200, 15 14 20) / <alpha-value>)',
          300: 'rgb(var(--dark-300, 8 7 10) / <alpha-value>)',
        },
        // Subtle glass surfaces
        glass: {
          white: 'rgba(255, 255, 255, 0.035)',
          border: 'rgba(255, 255, 255, 0.06)',
          hover: 'rgba(255, 255, 255, 0.07)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'Cambria', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2.5s infinite',
        'warm-glow': 'warmGlow 4s ease-in-out infinite',
        'grain': 'grain 8s steps(10) infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        warmGlow: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -10%)' },
          '20%': { transform: 'translate(-15%, 5%)' },
          '30%': { transform: 'translate(7%, -25%)' },
          '40%': { transform: 'translate(-5%, 25%)' },
          '50%': { transform: 'translate(-15%, 10%)' },
          '60%': { transform: 'translate(15%, 0%)' },
          '70%': { transform: 'translate(0%, 15%)' },
          '80%': { transform: 'translate(3%, 35%)' },
          '90%': { transform: 'translate(-10%, 10%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(194, 51, 80, 0.2)',
        'glow-lg': '0 0 40px rgba(194, 51, 80, 0.3)',
        'glow-gold': '0 0 20px rgba(212, 168, 87, 0.15)',
        'inner-warm': 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'elevated': '0 4px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        'dramatic': '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04)',
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
