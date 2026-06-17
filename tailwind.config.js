/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0b1220',
          800: '#101a2e',
          700: '#16233d',
          600: '#1d2d4d',
        },
        gold: {
          400: '#f5c542',
          500: '#e0a82e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
