/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // The "Sign" system: six tokens, one face. Everything else is layout.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      // field/deep are CSS variables so the reading screens (results, cart)
      // can swap the yellow for cream; see index.css.
      field: 'var(--field)', // page background
      deep: 'var(--deep)', // inputs, options, modal panels, image placeholders
      ink: '#141414', // all type, rules, arrows, the marker
      mist: 'rgba(20,20,20,.62)', // secondary type
      line: 'rgba(20,20,20,.22)', // 2px row rules
      'line-strong': 'rgba(20,20,20,.5)', // input underlines, outline markers
    },
    extend: {
      fontFamily: {
        sans: ["'Barlow Condensed'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        jp: ["'Noto Sans JP'", 'sans-serif'],
      },
    },
  },
  plugins: [],
}
