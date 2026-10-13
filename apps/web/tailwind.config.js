/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0B1B3A',
        orange: '#F26A1B',
        blue: '#2F6FDE',
        green: '#0F7A5F',
        red: '#B91C1C',
        amber: '#D97706',
        rust: '#C2500F',
        cream: '#FFF6EE',
        peach: '#FDE8D7',
        tint: '#E8ECF4',
      },
    },
  },
  plugins: [],
};
