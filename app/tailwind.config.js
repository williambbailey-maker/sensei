/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Hyper-Saturated Fluid: a Deep Onyx void with one Cyber Yellow shout
        // color and glassmorphic surfaces. Existing token names are re-pointed
        // for a dark theme (ink = white text/strokes; ice = onyx page), plus
        // explicit yellow/onyx/charcoal names for new fluid components.
        yellow: '#9CB89C', // primary accent → sage (dark-theme value)
        onyx: '#141D17', // deep void background (= --bg / --on-accent)
        charcoal: '#1C271F', // secondary dark panels (--surface)
        voidgray: '#26332A', // UI in the void (--surface-2)

        // Warm sage/citrus palette (dark variant) mapped onto the same names.
        ink: '#EEF1EA', // primary text
        ice: '#141D17', // page background (--bg)
        panel: '#1C271F', // raised surface (--surface)
        card: '#1C271F',
        cream: '#141D17',
        muted: '#9FB0A2', // secondary text (--ink-dim)
        line: 'rgba(238,241,234,0.14)',
        'line-dark': 'rgba(238,241,234,0.10)',
        sage: '#9CB89C', // primary accent (--accent)
        'sage-deep': '#B9D0B9',
        'sage-soft': 'rgba(156,184,156,0.16)',
        clay: '#E8A33D', // secondary accent → citrus
        'clay-deep': '#EDB45F',
        blue: '#9CB89C',
        'blue-d': '#B9D0B9',
        orange: '#E8A33D',
        'orange-d': '#EDB45F',
        steel: '#9FB0A2',
        'steel-dim': '#6F8072',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.16em',
      },
      borderWidth: {
        3: '2px',
      },
      boxShadow: {
        // Soft, large-radius dark shadows to lift glass off the void.
        soft: '0 20px 60px rgba(0,0,0,0.45)',
        'soft-sm': '0 10px 30px rgba(0,0,0,0.35)',
        'soft-lg': '0 30px 80px rgba(0,0,0,0.6)',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
