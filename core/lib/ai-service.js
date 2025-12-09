/**
 * ClowerEdit AI Service
 * Service d'intégration avec Gemini Flash via SDK officiel @google/genai
 * Documentation: https://github.com/googleapis/js-genai
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_CONFIG_PATH = path.join(__dirname, '../../config/ai.json');
const SITES_DATA_PATH = path.join(__dirname, '../../data/sites');

// Cache du client AI par site
const chatSessions = new Map();

/**
 * Charge la configuration AI globale (fallback)
 */
function loadAIConfig() {
  try {
    const raw = fs.readFileSync(AI_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[AI] Erreur chargement config globale:', err.message);
    return { enabled: false };
  }
}

/**
 * Charge la configuration AI spécifique à un site
 * Priorité : config site > config globale
 */
function loadSiteAIConfig(siteSlug) {
  const siteConfigPath = path.join(SITES_DATA_PATH, siteSlug, 'config', 'ai.json');
  const globalConfig = loadAIConfig();
  
  try {
    if (fs.existsSync(siteConfigPath)) {
      const raw = fs.readFileSync(siteConfigPath, 'utf-8');
      const siteConfig = JSON.parse(raw);
      // Fusionner : la config site a priorité
      return {
        ...globalConfig,
        ...siteConfig,
        // Utiliser apiKey du site si défini, sinon fallback global
        apiKey: siteConfig.apiKey || globalConfig.apiKey,
        enabled: siteConfig.enabled !== undefined ? siteConfig.enabled : globalConfig.enabled
      };
    }
  } catch (err) {
    console.error('[AI] Erreur chargement config site:', err.message);
  }
  
  return globalConfig;
}

/**
 * Crée ou récupère une instance GoogleGenAI
 */
function getAIClient(config) {
  if (!config.apiKey) {
    throw new Error('Clé API non configurée');
  }
  return new GoogleGenAI({ apiKey: config.apiKey });
}

/**
 * Charge l'historique de conversation d'un site
 */
function loadConversationHistory(siteSlug) {
  const historyPath = path.join(SITES_DATA_PATH, siteSlug, 'ai-history.json');
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (err) {
    console.error('[AI] Erreur chargement historique:', err.message);
  }
  return { messages: [], lastUpdated: null };
}

/**
 * Sauvegarde l'historique de conversation
 */
function saveConversationHistory(siteSlug, history) {
  const historyPath = path.join(SITES_DATA_PATH, siteSlug, 'ai-history.json');
  try {
    history.lastUpdated = new Date().toISOString();
    // Garder seulement les 20 derniers messages
    if (history.messages.length > 20) {
      history.messages = history.messages.slice(-20);
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AI] Erreur sauvegarde historique:', err.message);
  }
}

/**
 * Prompt système immuable avec instructions complètes
 */
const SYSTEM_PROMPT_BASE = `Tu es l'assistant IA intégré de ClowerEdit, un CMS statique éco-conçu.

=== TON RÔLE ===
Tu es l'expert créatif et technique du site. Tu dois :
1. LIRE ATTENTIVEMENT la description du projet ci-dessous pour comprendre le contexte, le ton, les valeurs et les objectifs du site
2. RÉPONDRE de façon précise, intelligible et contextuelle aux questions
3. PROPOSER des modifications pertinentes alignées avec la vision du projet
4. AIDER à améliorer les contenus, le design et la stratégie du site

Tu réponds TOUJOURS en français. Tu es concis, pratique et orienté solutions.
Quand l'utilisateur pose une question, réponds directement et clairement AVANT de proposer une action.

=== TES CAPACITÉS D'ÉDITION ===
Tu peux modifier :
1. **Les pages** : titre, description, SEO, blocs (contenu et apparence)
2. **Le thème global** : couleurs (primary, secondary, accent, background, text), typographies
3. **Les blocs** : tous leurs settings (titres, textes, images, layout, etc.)

IMPORTANT : Toute modification nécessite la VALIDATION de l'utilisateur.
Quand tu proposes un changement, retourne un bloc JSON avec "action": "propose-edit" ou "action": "propose-theme".

=== FORMAT POUR ÉDITER UNE PAGE ===
\`\`\`json
{
  "action": "propose-edit",
  "pageId": "nom-du-fichier-sans-extension",
  "reason": "Explication claire de ce que tu modifies et pourquoi",
  "changes": {
    "title": "Nouveau titre (optionnel)",
    "description": "Nouvelle description (optionnel)",
    "seo": { "metaTitle": "...", "metaDescription": "..." },
    "blockUpdate": {
      "blockId": "id-du-bloc-existant",
      "settings": { "title": "...", "content": "...", "etc": "..." }
    }
  }
}
\`\`\`

=== FORMAT POUR ÉDITER LE THÈME ===
\`\`\`json
{
  "action": "propose-theme",
  "reason": "Explication de la nouvelle palette et pourquoi elle convient au projet",
  "changes": {
    "colors": {
      "primary": "violet-600",
      "secondary": "slate-600",
      "accent": "emerald-500",
      "background": "white",
      "text": "slate-900"
    },
    "typography": {
      "headings": "Outfit, sans-serif",
      "body": "Inter, sans-serif"
    }
  }
}
\`\`\`

=== RÈGLES DE COMPORTEMENT ===
1. **Lis la description du projet** : Elle contient le ton, les valeurs, la cible, les objectifs. Base-toi dessus pour TOUTES tes réponses.
2. **Réponds d'abord, propose ensuite** : Quand on te pose une question, réponds avec des explications PUIS propose une action si pertinent.
3. **Une modification à la fois** : Ne propose qu'UN changement par message pour faciliter la validation.
4. **Sois spécifique** : Cite les noms de pages, de blocs, les couleurs exactes que tu proposes.
5. **Reste cohérent** : Si le projet a une charte graphique définie, respecte-la. Si tu proposes une évolution, justifie-la.

=== TYPES DE BLOCS DISPONIBLES ===
• Hero : title, subtitle, ctaLabel, ctaUrl, image, layout (fullwidth-bg|flex-row|flex-row-reverse), height, contentAlign, textAlign, overlay, titleSize
• Paragraphe : title, content, align, titleSize, textSize, bg, shadow, borderRadius
• Image : src, alt, caption, rounded, shadow, maxWidth, align
• Groupe : layout (grid|flex), columnsMobile, columnsDesktop, gap, children (tableau de blocs)
• CollectionGrid : collectionId, limit, columnsDesktop
• Form : formTitle, actionUrl, submitLabel
• NewsletterEmbed : title, serviceName, embedCode

=== COULEURS TAILWIND (pour le thème) ===
Format : nom-intensité (ex: violet-600, slate-900, emerald-500)
Palettes : slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose
Intensités : 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950

=== RÈGLES TECHNIQUES ===
- Les "id" de blocs sont uniques (ex: hero-1, para-2)
- Les "slug" commencent par "/" et sont en kebab-case
- Pour les blocs JSON, utilise \`\`\`json ... \`\`\`
- Les polices recommandées : Inter, Outfit, Poppins, DM Sans, Manrope, Space Grotesk`;

/**
 * Construit le prompt système enrichi du contexte du site
 */
function buildSystemPrompt(config, siteContext) {
  let prompt = SYSTEM_PROMPT_BASE;
  
  // Ajouter la description du projet (priorité: projectPrompt > projectDescription)
  const projectDesc = config.projectPrompt || config.projectDescription;
  if (projectDesc && projectDesc.trim()) {
    prompt += `\n\n=== 📋 DESCRIPTION DU PROJET (LIS ATTENTIVEMENT) ===
${projectDesc.trim()}

IMPORTANT : Cette description définit le ton, les valeurs, la cible et les objectifs du projet. 
BASE TOUTES TES RÉPONSES sur ce contexte. Adapte ton vocabulaire et tes suggestions à ce projet spécifique.`;
  }
  
  // Ajouter le contexte du site
  prompt += `\n\n=== 🌐 CONTEXTE TECHNIQUE DU SITE ===
Nom du site: ${siteContext.siteName || 'Non défini'}
Slug: ${siteContext.slug}`;

  // Thème complet avec toutes les couleurs
  if (siteContext.theme) {
    prompt += `\n\n=== 🎨 THÈME ACTUEL ===
Tu peux proposer des modifications du thème avec "action": "propose-theme".

Couleurs actuelles:
- primary: ${siteContext.theme.primary || siteContext.theme.colors?.primary || 'violet-600'}
- secondary: ${siteContext.theme.secondary || siteContext.theme.colors?.secondary || 'slate-600'}
- accent: ${siteContext.theme.accent || siteContext.theme.colors?.accent || 'violet-500'}
- background: ${siteContext.theme.background || siteContext.theme.colors?.background || 'white'}
- text: ${siteContext.theme.text || siteContext.theme.colors?.text || 'slate-900'}

Typographies:
- Titres: ${siteContext.theme.fontHeading || siteContext.theme.typography?.headings || 'Inter, sans-serif'}
- Textes: ${siteContext.theme.fontBody || siteContext.theme.typography?.body || 'Inter, sans-serif'}`;
  }

  if (siteContext.pages && siteContext.pages.length > 0) {
    prompt += `\n\n=== 📄 PAGES DU SITE ===`;
    siteContext.pages.forEach(p => {
      const pageName = p.name || p.title || 'Sans titre';
      prompt += `\n- "${pageName}" → pageId: "${p.id || 'inconnu'}", slug: "${p.slug || '/'}"`;
    });
  }

  // Ajouter le contenu complet des pages pour l'analyse
  if (siteContext.pagesFullContent && siteContext.pagesFullContent.length > 0) {
    prompt += `\n\n=== 📝 CONTENU DÉTAILLÉ DES PAGES ===
Tu as accès au contenu COMPLET des pages. Analyse-les pour répondre précisément aux questions.`;
    
    siteContext.pagesFullContent.forEach(page => {
      const pageName = page.name || page.title || 'Sans titre';
      prompt += `\n\n──────────────────────────────
📄 PAGE: ${page.id}.json
Nom: "${pageName}"
Titre complet: "${page.title || '(aucun)'}"
Slug: ${page.slug || '/'}
Description: ${page.description || '(aucune)'}`;
      
      if (page.seo) {
        prompt += `\nSEO: metaTitle="${page.seo.metaTitle || ''}", metaDescription="${page.seo.metaDescription || ''}"`;
      }
      
      if (page.blocks && page.blocks.length > 0) {
        prompt += `\n\nBlocs (${page.blocks.length}):`;
        page.blocks.forEach((block, i) => {
          prompt += `\n  ${i+1}. [${block.type}] id="${block.id}"`;
          if (block.label) prompt += `, label="${block.label}"`;
          if (block.settings) {
            const s = block.settings;
            if (s.title) prompt += `\n      → title: "${s.title}"`;
            if (s.subtitle) prompt += `\n      → subtitle: "${s.subtitle}"`;
            if (s.content) {
              const contentPreview = s.content.substring(0, 150).replace(/\n/g, ' ');
              prompt += `\n      → content: "${contentPreview}${s.content.length > 150 ? '...' : ''}"`;
            }
            if (s.ctaLabel) prompt += `\n      → CTA: "${s.ctaLabel}" → ${s.ctaUrl || '#'}`;
            if (s.image) prompt += `\n      → image: ${s.image}`;
            if (s.layout) prompt += `\n      → layout: ${s.layout}`;
          }
          // Afficher les enfants si c'est un Groupe
          if (block.children && block.children.length > 0) {
            prompt += `\n      → enfants: ${block.children.length} blocs`;
            block.children.forEach((child, j) => {
              prompt += `\n         ${j+1}. [${child.type}] id="${child.id}"`;
              if (child.settings?.title) prompt += `, title="${child.settings.title}"`;
            });
          }
        });
      }
    });
    prompt += `\n──────────────────────────────`;
  }

  if (siteContext.collections && siteContext.collections.length > 0) {
    prompt += `\n\n=== 📚 COLLECTIONS ===
${siteContext.collections.join(', ')}`;
  }

  return prompt;
}

/**
 * Prépare les contenus pour le SDK Gemini (format correct)
 */
function prepareContents(history) {
  return history.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
}

/**
 * Extrait le JSON d'une réponse texte si présent
 */
function extractJSON(text) {
  // Cherche un bloc JSON dans la réponse
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Pas de JSON valide
    }
  }
  
  // Essaie de parser directement si c'est du JSON pur
  try {
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return JSON.parse(text.trim());
    }
  } catch (e) {
    // Pas du JSON
  }
  
  return null;
}

/**
 * Chat avec l'assistant IA via SDK @google/genai
 * @param {string} siteSlug - Slug du site
 * @param {string} userMessage - Message de l'utilisateur
 * @param {object} siteContext - Contexte du site (theme, pages, etc.)
 * @param {object} options - Options additionnelles
 * @returns {Promise<{text: string, json: object|null, error: string|null}>}
 */
async function chat(siteSlug, userMessage, siteContext = {}, options = {}) {
  // Charger la config spécifique au site (avec fallback global)
  const config = loadSiteAIConfig(siteSlug);
  
  if (!config.enabled) {
    return { text: null, json: null, error: 'Assistant IA désactivé' };
  }
  
  if (!config.apiKey) {
    return { text: null, json: null, error: 'Clé API non configurée. Configurez-la dans Paramètres → AI Assistant.' };
  }

  try {
    // Initialiser le client
    const ai = getAIClient(config);
    const model = config.model || 'gemini-2.5-flash';
    
    // Charger historique
    const history = options.clearHistory ? { messages: [] } : loadConversationHistory(siteSlug);
    
    // Construire le prompt système
    const systemPrompt = buildSystemPrompt(config, { ...siteContext, slug: siteSlug });
    
    // Préparer les contenus avec historique
    const contents = [];
    
    // Ajouter l'historique récent (5 derniers échanges max = 10 messages)
    const recentHistory = history.messages.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    // Ajouter le nouveau message utilisateur
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });
    
    // Appeler l'API Gemini avec le SDK officiel
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: {
          thinkingBudget: 0  // Désactiver le thinking pour des réponses rapides
        }
      }
    });
    
    const responseText = response.text;
    
    // Sauvegarder dans l'historique
    history.messages.push({ role: 'user', content: userMessage });
    history.messages.push({ role: 'assistant', content: responseText });
    saveConversationHistory(siteSlug, history);
    
    // Extraire JSON si présent
    const jsonData = extractJSON(responseText);
    
    return {
      text: responseText,
      json: jsonData,
      error: null
    };
  } catch (err) {
    console.error('[AI] Erreur chat:', err.message);
    return {
      text: null,
      json: null,
      error: err.message || 'Erreur inconnue'
    };
  }
}

/**
 * Efface l'historique de conversation d'un site
 */
function clearHistory(siteSlug) {
  const historyPath = path.join(SITES_DATA_PATH, siteSlug, 'ai-history.json');
  try {
    if (fs.existsSync(historyPath)) {
      fs.unlinkSync(historyPath);
    }
    return true;
  } catch (err) {
    console.error('[AI] Erreur suppression historique:', err.message);
    return false;
  }
}

/**
 * Prompts prédéfinis pour actions rapides
 */
const quickPrompts = {
  suggestColors: (currentPrimary) => 
    `Suggère-moi 3 palettes de couleurs harmonieuses pour mon site. Ma couleur primaire actuelle est "${currentPrimary || 'violet-600'}". Pour chaque palette, donne: primary, secondary, accent, et background. Utilise les noms de couleurs Tailwind (ex: violet-600, emerald-500, slate-900).`,
  
  improveText: (text) => 
    `Améliore ce texte pour le rendre plus engageant et professionnel, tout en restant concis:\n\n"${text}"`,
  
  generateSEO: (pageTitle, pageContent) => 
    `Génère un meta title (max 60 caractères) et une meta description (max 160 caractères) optimisés pour le SEO pour cette page:\n\nTitre: ${pageTitle}\nContenu: ${pageContent?.substring(0, 500) || 'Page sans contenu'}`,
  
  generateHeroBlock: (topic) => 
    `Génère un bloc Hero en JSON pour: "${topic}". Inclus un titre accrocheur, un sous-titre, et un CTA. Format attendu: { "type": "hero", "label": "...", "settings": { "title": "...", "subtitle": "...", "ctaLabel": "...", "ctaUrl": "#" } }`,
  
  generateLandingPage: (topic) => 
    `Génère la structure JSON d'une landing page pour: "${topic}". Inclus: 1 Hero, 2-3 sections de contenu, 1 CTA final. Retourne un tableau de blocs JSON.`,
  
  suggestBlocks: (pageType) => 
    `Pour une page de type "${pageType}", quels blocs recommandes-tu et dans quel ordre? Explique brièvement pourquoi.`
};

export {
  chat,
  clearHistory,
  loadAIConfig,
  loadSiteAIConfig,
  loadConversationHistory,
  quickPrompts,
  extractJSON
};
