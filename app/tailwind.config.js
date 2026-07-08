/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fancy-minimal monochrome system: near-black ink, soft paper white,
        // a brighter white for cards, and a steel grey for quiet metal
        // accents (the katana in the intro, hairline dividers).
        ink: '#0B0B0C', // primary text, borders, solid fills
        ice: '#F6F5F2', // page background (soft paper)
        panel: '#FBFAF8', // card/panel background (brighter white)
        muted: '#85837E', // secondary text
        line: 'rgba(11,11,12,0.13)', // hairline dividers/borders on white
        'line-dark': 'rgba(246,245,242,0.16)', // hairline dividers/borders on black
        steel: '#C7CAD0',
        'steel-dim': '#9A9DA3',
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
