/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Earthy pop system: warm cream field, deep indigo-navy, sage-green
        // accent — the three requested colors, with navy standing in for the
        // black outlines so the whole thing reads soft and cohesive.
        ice: '#ECDFD2', // warm cream page background
        cobalt: '#384166', // deep indigo-navy (primary dark)
        'cobalt-deep': '#2C3350',
        magenta: '#639D75', // sage-green accent
        sun: '#639D75', // sage highlight
        tomato: '#B5502A', // muted terracotta for warnings
        ink: '#384166', // outlines/shadows are navy, not black
        paper: '#ECDFD2', // page bg alias
        panel: '#FFFFFF', // white cards & pills
        line: '#384166',
        muted: '#6E718C', // muted navy text
        cream: '#ECDFD2',
        navy: '#384166',
        sage: '#639D75',
        // aliases kept so existing call sites keep compiling
        accent: {
          DEFAULT: '#384166',
          soft: '#639D75',
        },
        clay: '#B5502A',
        slate: '#639D75',
        ochre: '#C08A3E',
      },
      fontFamily: {
        // Baloo 2 = rounded, friendly, heavy display (matches the reference's
        // rounded lettering); Hanken Grotesk = clean refined UI/body.
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.08em',
      },
      borderWidth: {
        3: '3px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        wobble: {
          '0%,100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        bounce2: {
          '0%,100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-14px)' },
          '55%': { transform: 'translateY(0)' },
          '70%': { transform: 'translateY(-6px)' },
          '85%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        marquee: 'marquee 22s linear infinite',
        'marquee-fast': 'marquee 14s linear infinite',
        wobble: 'wobble 3.5s ease-in-out infinite',
        bounce2: 'bounce2 2.4s cubic-bezier(0.3, 0.7, 0.4, 1) infinite',
      },
    },
  },
  plugins: [],
}
