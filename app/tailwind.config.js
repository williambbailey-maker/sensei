/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm-neutral, gallery-like base (Swiss / quiet-luxury).
        paper: '#F2EFE7', // page background, warm paper
        panel: '#FAF8F2', // lifted section background
        line: '#E4DED0', // hairline rules & borders
        accent: {
          DEFAULT: '#9A6A3C', // restrained warm bronze
          soft: '#B4885B',
        },
        // Muted modular tones for the USM-style color-block motif.
        clay: '#B06E4A',
        sand: '#CBB68F',
        slate: '#6E7B83',
        ochre: '#BC8A40',
      },
      fontFamily: {
        sans: [
          '"Helvetica Neue"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Arial',
          'sans-serif',
        ],
      },
      letterSpacing: {
        label: '0.22em',
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
