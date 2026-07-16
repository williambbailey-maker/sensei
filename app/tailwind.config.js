/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colorblock swatch-poster system: cream paper, near-navy ink, and
        // exactly two accents — royal blue + orange. The existing token names
        // (ice/panel/muted/line/sage/clay…) are kept but re-pointed at the new
        // palette so the whole app re-skins at once; new poster components use
        // the explicit names (cream/card/blue/orange).
        cream: '#F5EFDF',
        card: '#FBF7EC',
        ink: '#1B2A4A', // near-navy — all borders + body text
        blue: '#1E3F8B',
        'blue-d': '#152C63',
        orange: '#F0871E',
        'orange-d': '#D9720E',

        // Back-compat aliases → new palette
        ice: '#F5EFDF', // page background → cream
        panel: '#FBF7EC', // raised surfaces → card
        muted: '#5B6478', // secondary text (gray-blue, kept legible)
        line: 'rgba(27,42,74,0.14)', // hairline on cream
        'line-dark': 'rgba(245,239,223,0.18)', // hairline on ink
        sage: '#1E3F8B', // primary accent → blue (selected states, key actions)
        'sage-deep': '#152C63',
        'sage-soft': '#E3E8F3', // quiet blue tint for backgrounds
        clay: '#F0871E', // warm accent → orange
        'clay-deep': '#D9720E',
        steel: '#9AA3B5',
        'steel-dim': '#6B7793',
      },
      fontFamily: {
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.13em',
      },
      borderWidth: {
        3: '2px', // the system's printed "solid ink outline"
      },
      boxShadow: {
        // Hard offset shadows only — never soft blur. Keeps it feeling printed.
        soft: '8px 8px 0 0 rgba(27,42,74,0.12)',
        'soft-sm': '5px 5px 0 0 rgba(27,42,74,0.12)',
        'soft-lg': '10px 10px 0 0 rgba(27,42,74,0.14)',
      },
    },
  },
  plugins: [],
}
