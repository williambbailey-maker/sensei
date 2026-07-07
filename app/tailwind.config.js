/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // TRANS×HOME (変身する家) system: warm paper, warm near-black ink, one
        // earthy terracotta accent, hairline rules. No cool tones, no shadows.
        paper: '#F4F0E8', // warm off-white — primary background
        'paper-2': '#EBE5DA', // slightly deeper — alternating sections
        panel: '#F4F0E8', // surfaces sit on paper; depth from hairlines, not cards
        ink: '#1C1B19', // warm near-black — primary text
        'ink-soft': '#6E6A62', // secondary text, captions
        muted: '#6E6A62', // alias kept for existing call sites
        hairline: '#D9D3C7', // dividers, borders, 1px rules
        line: '#D9D3C7', // alias kept for existing call sites
        accent: {
          DEFAULT: '#B5502A', // earthy terracotta — CTAs, active state
          soft: '#C6693F',
        },
        // Semantic potency dots (kept small and functional, warmed to fit).
        clay: '#B5502A',
        slate: '#6E7A4E',
        ochre: '#C08A3E',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        grotesk: ['"Space Grotesk"', 'ui-sans-serif', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.18em',
        tight2: '-0.01em',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
        quint: 'cubic-bezier(0.83, 0, 0.17, 1)',
      },
      maxWidth: {
        measure: '62ch',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.95s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
