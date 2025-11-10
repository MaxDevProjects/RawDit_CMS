(()=>{window.addEventListener("load",()=>{window.parent!==window&&window.parent.postMessage({type:"previewReady"},"*")});(function(){let w=document.createElement("style");w.textContent=`
    .section-highlight {
      position: relative !important;
      animation: section-pulse 2s infinite !important;
      outline: 4px solid var(--color-primary, #7B61FF) !important;
      outline-offset: 4px !important;
    }
    
    .section-highlight::before {
      content: '';
      position: absolute;
      inset: -4px;
      border: 2px solid var(--color-primary, #7B61FF);
      border-radius: inherit;
      pointer-events: none;
      z-index: 999999 !important;
    }
    
    @keyframes section-pulse {
      0% { 
        box-shadow: 0 0 0 0 rgba(123, 97, 255, 0.5) !important;
        transform: scale(1) !important;
      }
      50% { 
        box-shadow: 0 0 20px 10px rgba(123, 97, 255, 0.2) !important;
        transform: scale(1.002) !important;
      }
      100% { 
        box-shadow: 0 0 0 0 rgba(123, 97, 255, 0) !important;
        transform: scale(1) !important;
      }
    }

    [data-theme="dark"] .section-highlight::before {
      border-color: var(--color-secondary, #A3E3C2);
    }
    
    [data-theme="contrast"] .section-highlight::before {
      border-color: #FFD700;
    }
  `,document.head.appendChild(w);let h=null,u=t=>t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),b=t=>u(t).replace(/`/g,"&#96;"),v=(t={})=>{let s=t.eyebrow?`<p class="hero-eyebrow">${u(t.eyebrow)}</p>`:"",i=`<h1>${u(t.title||"")}</h1>`,a=t.subtitle?`<p class="hero-subtitle">${u(t.subtitle)}</p>`:"",n=t.cta?`<a class="hero-cta" href="${b(t.ctaLink||"#")}">${u(t.cta)}</a>`:"";return`<div class="hero-content">${s}${i}${a}${n}</div>`},x=(t={})=>`<div class="text-prose" aria-label="Bloc de texte">${t.content===void 0||t.content===null?"":String(t.content)}</div>`,A=(t={})=>{let s=b(t.src||""),i=u(t.alt||""),a=t.caption?`<figcaption>${u(t.caption)}</figcaption>`:"";return`<figure class="media-figure"><img src="${s}" alt="${i}" />${a}</figure>`},B=(t={})=>{let s=Array.isArray(t.children)?t.children:[],i=s.length>0,a=t.style||{},n=a.layout||(i?"flex flex-col":""),p=a.gap||(i?"gap-6":""),e=a.align||(i?"justify-start items-start":""),r=[n,p,e].filter(Boolean).join(" ").trim(),c=` class="${b(r)}"`,o=s.map(l=>$(l)).join("");return`<div data-group-container${c}>${o}</div>`},$=(t={})=>{let s=t.type||"",i=t.props||{};return s==="hero"?v(i):s==="text"?x(i):s==="image"?A(i):s==="groupe"?B(t):""},E=(t=[])=>{let s=document.getElementById("contenu");if(!s)return;let i=Array.isArray(t)?t:[],a=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0,n=new Map(Array.from(s.querySelectorAll("[data-section-id]")).map(e=>[e.dataset.sectionId,e]));i.forEach((e,r)=>{if(!e||e.id===void 0||e.id===null)return;let c=String(e.id),o=n.get(c);o||(o=document.createElement("section"),o.dataset.sliceBase="slice"),o.dataset.sliceBase="slice";let l=o.classList.contains("section-highlight"),f=e.preset&&e.preset!=="slice"?e.preset:"",d=Array.isArray(e.tokens)?e.tokens.filter(Boolean):[],g=["slice"];f&&g.push(f),d.forEach(m=>{m&&!g.includes(m)&&g.push(m)}),o.id=`section-${c}`,o.dataset.sectionId=c,o.dataset.sectionType=e.type||"",o.dataset.sectionPreset=f||"slice",o.setAttribute("aria-label",`Section ${r+1}`),o.className=g.join(" ").trim(),o.innerHTML=$(e);let y=s.children[r];y!==o&&s.insertBefore(o,y||null),(l||h===c)&&o.classList.add("section-highlight"),n.delete(c)}),n.forEach(e=>e.remove()),i.some(e=>String(e==null?void 0:e.id)===h)||(h=null),window.requestAnimationFrame(()=>{window.scrollTo(0,a)})};window.addEventListener("message",t=>{let{type:s,sectionId:i,sections:a}=t.data;if(s==="selectSection"){if(h){let n=document.getElementById(`section-${h}`);n&&n.classList.remove("section-highlight")}if(h=i,i){let n=document.getElementById(`section-${i}`);n&&(n.classList.add("section-highlight"),n.scrollIntoView({behavior:"smooth",block:"center"}))}}else if(s==="syncSections")E(a||[]);else if(s==="updateSectionStyle"){if(!i)return;let n=document.getElementById(`section-${i}`);if(!n)return;let{tokens:p=[],preset:e=null,style:r=null}=t.data,c=n.dataset.sliceBase||"slice",o=e||n.dataset.sectionPreset||"",l=[c];o&&l.push(o),Array.isArray(p)&&p.forEach(d=>{d&&!l.includes(d)&&l.push(d)});let f=n.classList.contains("section-highlight");if(n.className=l.join(" ").trim(),n.dataset.sectionType==="groupe"){let d=n.querySelector("[data-group-container]");if(d){let g=(r==null?void 0:r.layout)||"",y=(r==null?void 0:r.gap)||"",m=(r==null?void 0:r.align)||"";d.className=[g,y,m].filter(Boolean).join(" ").trim()}}f&&n.classList.add("section-highlight"),e&&(n.dataset.sectionPreset=e)}})})();})();
