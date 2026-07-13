/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Earthy botanical system: warm parchment page, cream cards, warm
        // charcoal ink, taupe secondary text — with sage-green and terracotta
        // (clay) as the living accents. Steel tokens stay warm neutral taupes
        // (potency dots, quiet text on dark cards).
        ink: '#2B2A24', // primary text, borders, solid fills (warm charcoal)
        ice: '#F1EBDD', // page background (warm parchment)
        panel: '#FBF6EA', // card/panel background (cream)
        muted: '#8B8271', // secondary text (warm taupe)
        line: 'rgba(43,42,36,0.14)', // hairline dividers/borders on cream
        'line-dark': 'rgba(241,235,221,0.18)', // hairline dividers/borders on charcoal
        steel: '#C3BBAA', // warm light taupe (potency dot, quiet accents on dark)
        'steel-dim': '#A79E8C', // warm taupe (secondary text on dark)
        // Living accents
        sage: '#5F7A4B', // primary botanical accent — selected states, key actions
        'sage-deep': '#4B6339', // deeper sage (hover)
        'sage-soft': '#E5E7D2', // quiet sage tint for backgrounds
        clay: '#B4603C', // warm terracotta accent
        'clay-deep': '#9A4F30', // deeper terracotta (hover)
      },
      fontFamily: {
        // One rounded, humanist family (Aptos-like) for both display and body —
        // weight alone carries the hierarchy.
        display: ['"Plus Jakarta Sans"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.08em',
      },
      borderWidth: {
        3: '1.5px', // the app's "solid ink outline" — thinned from the old 3px pop-art weight
      },
      boxShadow: {
        soft: '0 18px 40px rgba(11,11,12,0.08)',
        'soft-sm': '0 6px 18px rgba(11,11,12,0.07)',
        'soft-lg': '0 24px 60px rgba(11,11,12,0.12)',
      },
    },
  },
  plugins: [],
}
