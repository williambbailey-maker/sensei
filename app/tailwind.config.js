/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // forn.dk reference system: near-white field, black type, one deep
        // cobalt accent, hairline gray borders, muted gray secondary text.
        paper: '#F5ECCF', // manila-yellow zine paper
        panel: '#FFFFFF', // card background
        line: '#111111', // heavy black outlines
        lemon: '#F7D14A', // sticker yellow
        accent: {
          DEFAULT: '#E3350D', // punk red
          soft: '#F06543',
        },
        muted: '#6B6456',
        // Semantic potency dots (kept small and functional).
        clay: '#BC4749',
        slate: '#6A994E',
        ochre: '#E0A458',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
        display: ['"Archivo Black"', 'Impact', 'ui-sans-serif', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.14em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'scale-in': 'scale-in 0.5s ease both',
      },
    },
  },
  plugins: [],
}
