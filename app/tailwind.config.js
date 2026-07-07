/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PLAZA-60th pop system: icy blue field, bold cobalt, crisp white,
        // hot magenta accent, black outlines. Flat, bright, playful.
        ice: '#E7F3FC', // pale icy-blue page background
        cobalt: '#1E3AD6', // bold brand blue
        'cobalt-deep': '#182FB0',
        magenta: '#EC1C92', // hot pink accent
        sun: '#FFC93C', // warm sticker yellow
        tomato: '#F0562E', // sticker orange-red
        ink: '#111111', // outline / near-black
        paper: '#E7F3FC', // page bg alias
        panel: '#FFFFFF', // white cards & pills
        line: '#111111', // outlines are black in this system
        muted: '#5B6B86', // muted blue-grey text
        // aliases kept so existing call sites keep compiling
        accent: {
          DEFAULT: '#1E3AD6', // primary actions = cobalt
          soft: '#EC1C92', // secondary pop = magenta
        },
        clay: '#F0562E',
        slate: '#3BA55C',
        ochre: '#FFC93C',
      },
      fontFamily: {
        // Anton = ultra-heavy condensed display; Archivo = bold geometric UI/body.
        display: ['Anton', 'Impact', 'ui-sans-serif', 'sans-serif'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.06em',
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
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        marquee: 'marquee 22s linear infinite',
        'marquee-fast': 'marquee 14s linear infinite',
        wobble: 'wobble 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
