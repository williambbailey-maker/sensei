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
        yellow: '#FDE047', // the "shout" color — cyber yellow
        onyx: '#0A0A0A', // deep void background
        charcoal: '#171717', // secondary dark panels
        voidgray: '#262626', // UI in the void

        // Back-compat aliases → dark theme
        ink: '#FFFFFF', // primary text + glass strokes (light on dark)
        ice: '#0A0A0A', // page background → onyx
        panel: '#171717', // raised surface → charcoal
        card: '#171717',
        cream: '#0A0A0A',
        muted: '#A3A3A3', // secondary text (gray)
        line: 'rgba(255,255,255,0.14)',
        'line-dark': 'rgba(255,255,255,0.10)',
        sage: '#FDE047', // primary accent → cyber yellow
        'sage-deep': '#EACA18',
        'sage-soft': 'rgba(253,224,71,0.16)',
        clay: '#FDE047',
        'clay-deep': '#EACA18',
        blue: '#FDE047',
        'blue-d': '#EACA18',
        orange: '#262626',
        'orange-d': '#171717',
        steel: '#A3A3A3',
        'steel-dim': '#737373',
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
