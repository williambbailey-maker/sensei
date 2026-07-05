/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm cream + caramel system (from the banhmivietnam.xyz reference):
        // brand cream base, caramel surface, red + green accents, black type.
        paper: '#F5ECD7', // page background (--brand)
        panel: '#FAF4E4', // lifted section background
        line: '#E3D5B8', // hairline rules & borders on cream
        accent: {
          DEFAULT: '#BC4749', // red (--surface-red) — hovers, highlights
          soft: '#D05A5C',
        },
        clay: '#BC4749', // strong potency, errors (red)
        sand: '#D4A373', // caramel (--surface)
        slate: '#6A994E', // green (--surface-green) — mild potency
        ochre: '#E0A458', // amber — medium potency
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
        display: ['"Asap Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.22em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'circle-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'circle-in': 'circle-in 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
