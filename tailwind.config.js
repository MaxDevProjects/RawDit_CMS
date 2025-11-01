import plugin from 'tailwindcss/plugin';
import { getCurrentTheme } from './backend/lib/theme.js';

const getThemeColors = async () => {
  try {
    const theme = await getCurrentTheme();
    return {
      primary: theme?.colors?.primary || '#7B61FF',
      secondary: theme?.colors?.secondary || '#A3E3C2',
      background: theme?.colors?.background || '#FFFFFF',
      text: theme?.colors?.text || '#1F2937',
      contrastBg: '#000000',
      contrastText: '#FFFFFF',
      contrastAccent: '#FFD700'
    };
  } catch (error) {
    console.error('Error loading theme:', error);
    return {};
  }
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './admin/**/*.{html,js}',
    './backend/templates/**/*.njk'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: await getThemeColors(),
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)'
      },
      borderRadius: {
        'sm': 'var(--radius-small)',
        'md': 'var(--radius-medium)',
        'lg': 'var(--radius-large)'
      }
    }
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('contrast', '.contrast &');
    }),
    plugin(({ addComponents, theme }) => {
      addComponents({
        '.surface-glass': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        },
        '.surface-card': {
          backgroundColor: theme('colors.white'),
          boxShadow: theme('boxShadow.lg'),
          borderRadius: theme('borderRadius.lg')
        }
      });
    })
  ]
};
