export const sectionPresets = {
  hero: [
    {
      id: 'hero-basic',
      label: 'Hero classique',
      description: 'Grand titre centré avec bouton principal.',
      surface: 'glass-hero',
      tokens: ['bg-gradient-to-br', 'from-indigo-500/90', 'to-emerald-400/80', 'text-white', 'shadow-xl', 'rounded-3xl']
    },
    {
      id: 'hero-split',
      label: 'Hero partagé',
      description: 'Hero avec deux colonnes texte + média.',
      surface: 'split-hero',
      tokens: ['bg-slate-900/80', 'border', 'border-white/10', 'backdrop-blur', 'text-white', 'grid', 'md:grid-cols-2', 'gap-8', 'rounded-3xl']
    }
  ],
  text: [
    {
      id: 'text-prose',
      label: 'Texte large',
      description: 'Bloc de texte lisible en largeur limitée.',
      surface: 'card',
      tokens: ['space-y-4', 'text-slate-200', 'leading-relaxed']
    },
    {
      id: 'text-feature',
      label: 'Points clés',
      description: 'Liste à puces pour mettre en avant des messages.',
      surface: 'feature-list',
      tokens: ['grid', 'gap-4', 'sm:grid-cols-2', 'text-slate-200']
    }
  ],
  image: [
    {
      id: 'image-wide',
      label: 'Image large',
      description: 'Image responsive avec légende centrée.',
      surface: 'media-wide',
      tokens: ['text-center', 'space-y-3']
    },
    {
      id: 'image-card',
      label: 'Carte média',
      description: 'Image entourée d’un cadre arrondi.',
      surface: 'media-card',
      tokens: ['rounded-3xl', 'border', 'border-white/10', 'shadow-lg', 'bg-white/10', 'p-6']
    }
  ]
};

export function getPreset(type, presetId) {
  return sectionPresets[type]?.find(preset => preset.id === presetId) || sectionPresets[type]?.[0];
}

export function createSection(type) {
  const preset = getPreset(type, null);
  const now = Date.now();
  const base = {
    id: `${type}-${now}`,
    type,
    preset: preset?.id || null,
    tokens: preset?.tokens || [],
    props: {}
  };
  if (type === 'hero') {
    base.props = {
      eyebrow: 'Nouveauté',
      title: 'Titre remarquable',
      subtitle: 'Sous-titre pour préciser votre proposition de valeur.',
      cta: 'En savoir plus',
      ctaLink: '#contact',
      media: ''
    };
  }
  if (type === 'text') {
    base.props = {
      content:
        '<p>Ajoutez votre contenu riche ici. Les paragraphes, listes et liens seront stylés automatiquement.</p>'
    };
  }
  if (type === 'image') {
    base.props = {
      src: '',
      alt: 'Description visuelle',
      caption: ''
    };
  }
  return base;
}

export const layoutPresets = [
  {
    id: 'layout',
    label: 'Classique',
    description: 'Navigation simple et sections empilées.',
    preview: 'layout-classic'
  },
  {
    id: 'layout-wide',
    label: 'Large',
    description: 'Sections pleine largeur pour les contenus immersifs.',
    preview: 'layout-wide'
  },
  {
    id: 'layout-compact',
    label: 'Compact',
    description: 'Padding réduit, idéal pour contenus denses.',
    preview: 'layout-compact'
  }
];
