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
      ink: '#f8f4e9', // all type, rules, CTA bar, marker
      mist: 'rgba(248,244,233,.6)', // secondary type
      line: 'rgba(248,244,233,.16)', // 1px hairlines
      'line-strong': 'rgba(248,244,233,.4)', // input underlines
    },
    extend: {
      fontFamily: {
        sans: ["'Helvetica Neue'", 'Helvetica', 'Inter', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
