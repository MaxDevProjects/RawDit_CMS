import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./admin/**/*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#7B61FF',
        secondary: '#A3E3C2',
        contrastBg: '#000000',
        contrastText: '#FFFFFF',
        contrastAccent: '#FFD700'
      }
    }
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('contrast', '.contrast &');
    })
  ]
};
