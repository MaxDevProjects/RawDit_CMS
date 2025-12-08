/** @type {import('tailwindcss').Config} */

// Génération dynamique des classes de couleur pour la safelist
const colors = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
];
const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Génère bg-{color}-{shade} et text-{color}-{shade}
const colorSafelist = [];
colors.forEach(color => {
  shades.forEach(shade => {
    colorSafelist.push(`bg-${color}-${shade}`);
    colorSafelist.push(`text-${color}-${shade}`);
    colorSafelist.push(`border-${color}-${shade}`);
  });
});

// Ajout des couleurs de base
colorSafelist.push('bg-white', 'bg-black', 'bg-transparent');
colorSafelist.push('text-white', 'text-black');

// Ajout des bordures arrondies
const radiusSafelist = [
  'rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg',
  'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'
];

// Ajout des ombres
const shadowSafelist = [
  'shadow-none', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl'
];

// Ajout des tailles de texte
const textSizeSafelist = [
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
  'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'
];

// Ajout des espacements
const spacingSafelist = [
  'space-y-2', 'space-y-3', 'space-y-4', 'space-y-6', 'space-y-8',
  'space-x-2', 'space-x-3', 'space-x-4', 'space-x-6', 'space-x-8',
  'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8', 'gap-10', 'gap-12'
];

// Ajout des alignements
const alignSafelist = [
  'text-left', 'text-center', 'text-right', 'text-justify',
  'items-start', 'items-center', 'items-end',
  'justify-start', 'justify-center', 'justify-end', 'justify-between'
];

// Hauteurs pour les images
const heightSafelist = [
  'h-32', 'h-40', 'h-48', 'h-56', 'h-64', 'h-72', 'h-80', 'h-96', 'h-auto', 'h-full'
];

// Object-fit
const objectFitSafelist = [
  'object-cover', 'object-contain', 'object-fill', 'object-none', 'object-scale-down'
];

module.exports = {
  content: [
    './templates/**/*.{njk,html}',
    './core/scripts/**/*.js',
    './data/**/*.json',  // Scan des fichiers JSON pour les classes dynamiques
  ],
  safelist: [
    ...colorSafelist,
    ...radiusSafelist,
    ...shadowSafelist,
    ...textSizeSafelist,
    ...spacingSafelist,
    ...alignSafelist,
    ...heightSafelist,
    ...objectFitSafelist,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

