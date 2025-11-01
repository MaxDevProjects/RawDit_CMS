import plugin from 'tailwindcss/plugin';
import fs from 'fs';
import path from 'path';

// Lecture synchrone du thème par défaut
const defaultTheme = {
  colors: {
    primary: '#7B61FF',
    secondary: '#A3E3C2',
    background: '#FFFFFF',
    text: '#1F2937'
  }
};

// Essayer de lire le thème actuel de manière synchrone
let currentTheme = defaultTheme;
try {
  const themePath = path.join(process.cwd(), 'backend/sites/default/theme.json');
  if (fs.existsSync(themePath)) {
    const themeContent = fs.readFileSync(themePath, 'utf8');
    currentTheme = JSON.parse(themeContent);
  }
} catch (error) {
  console.warn('Could not load theme.json, using default theme');
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './admin/**/*.{html,js}',
    './backend/templates/**/*.njk'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: currentTheme.colors?.primary || defaultTheme.colors.primary,
        secondary: currentTheme.colors?.secondary || defaultTheme.colors.secondary,
        background: currentTheme.colors?.background || defaultTheme.colors.background,
        text: currentTheme.colors?.text || defaultTheme.colors.text,
        contrastBg: '#000000',
        contrastText: '#FFFFFF',
        contrastAccent: '#FFD700'
      },
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
