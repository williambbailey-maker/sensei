/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Subway signage: six tokens. The eight MTA line colors live only in the
    // .mb bullets and .route lines, as CSS variables in index.css.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      field: '#0B0B0B', // page background
      deep: '#1E1E1E', // image placeholders, option backgrounds, scrim
      ink: '#F4EDDC', // all type, rules, CTA bar, marker
      mist: 'rgba(244,237,220,.6)', // secondary type
      line: 'rgba(244,237,220,.16)', // 1px hairlines
      'line-strong': 'rgba(244,237,220,.4)', // input underlines
    },
    extend: {
      fontFamily: {
        sans: ["'Helvetica Neue'", 'Helvetica', 'Inter', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
