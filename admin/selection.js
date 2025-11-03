// Gestionnaire de sélection des sections
window.sectionSelection = {
  activeSection: null,
  
  // Initialise l'observateur de section
  init() {
    window.addEventListener('message', this.handleMessage.bind(this));
    this.setupHighlight();
  },
  
  // Configure la surbrillance
  setupHighlight() {
    // Ajouter les styles dynamiques
    const style = document.createElement('style');
    style.textContent = `
      .section-highlight {
        position: relative;
        animation: section-pulse 2s infinite;
      }
      
      .section-highlight::before {
        content: '';
        position: absolute;
        inset: -2px;
        border: 2px solid var(--color-primary, #7B61FF);
        border-radius: inherit;
        pointer-events: none;
        z-index: 10;
      }
      
      @keyframes section-pulse {
        0% { box-shadow: 0 0 0 0 rgba(123, 97, 255, 0.3); }
        70% { box-shadow: 0 0 0 10px rgba(123, 97, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(123, 97, 255, 0); }
      }
    `;
    document.head.appendChild(style);
  },
  
  // Gère les messages de l'iframe
  handleMessage(event) {
    const { type, sectionId } = event.data;
    
    if (type === 'selectSection') {
      this.highlightSection(sectionId);
    }
  },
  
  // Met en surbrillance une section
  highlightSection(sectionId) {
    // Retire la surbrillance précédente
    if (this.activeSection) {
      const prevSection = document.getElementById(`section-${this.activeSection}`);
      if (prevSection) {
        prevSection.classList.remove('section-highlight');
      }
    }
    
    // Ajoute la nouvelle surbrillance
    this.activeSection = sectionId;
    if (sectionId) {
      const section = document.getElementById(`section-${sectionId}`);
      if (section) {
        section.classList.add('section-highlight');
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
};

// Initialise le gestionnaire de sélection
sectionSelection.init();