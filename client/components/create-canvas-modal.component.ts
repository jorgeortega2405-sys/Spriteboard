import { getBoardSvg, getDiagramSvg, getDocSvg, getTemplateVariantSvg } from './create-canvas-graphics.js';
import { PresetVariant } from '../config/templates.config.js';
import { createAndOpenCanvas, CreateCanvasOptions } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { DIAGRAM_CATEGORIES, DIAGRAM_SUBTYPES, DiagramCategory, DiagramSubtype } from '../types/mindmap.types.js';
import { DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

export interface OpenCreateCanvasModalOptions {
  boardTemplateId?: string;
  diagramSubtype?: DiagramSubtype;
  diagramTemplateId?: string;
  docOrientation?: DocOrientation;
  docPaperSize?: DocPaperSize;
  docTemplateId?: string;
  height?: number;
  initialType?: 'board' | 'diagram' | 'doc';
  name?: string;
  teamName?: string | null;
  teamUuid?: string | null;
  templateImage?: string | null;
  templateName?: string | null;
  variants?: PresetVariant[] | null;
  width?: number;
}

export function openCreateCanvasModal(options?: OpenCreateCanvasModalOptions): void {
  if (activeCreateCanvasModal) {
    activeCreateCanvasModal.close();
  }

  const templateVariants = options?.variants && options.variants.length > 0 ? options.variants : null;
  const templateName = options?.templateName || null;
  const templateImage = options?.templateImage || null;
  const normalizedInitialType = options?.initialType || 'board';
  let activeCategory: 'board' | 'diagram' | 'doc' | 'template' = templateVariants ? 'template' : normalizedInitialType;
  let isCreating = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  const modalTitle = templateName ? `Plantilla: ${templateName}` : (options?.teamName ? `Lienzo para ${options.teamName}` : 'Crear centro de trabajo');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-create-canvas-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>

      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-create-canvas">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-create-canvas-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-sidebar-top">
            <div class="component-top-left" data-ref="modal-sidebar-top-left">
              <h1 class="component-top-title">${modalTitle}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              ${templateVariants ? `
              <button type="button" class="menu-item is-active" data-ref="tab-category-template" data-category="template">
                <span class="material-symbols-rounded menu-item__icon">style</span>
                <span class="menu-item__text">Plantilla</span>
              </button>
              ` : ''}
              <button type="button" class="menu-item${activeCategory === 'board' ? ' is-active' : ''}" data-ref="tab-category-board" data-category="board">
                <span class="material-symbols-rounded menu-item__icon">space_dashboard</span>
                <span class="menu-item__text">Pizarrón Infinito</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'diagram' ? ' is-active' : ''}" data-ref="tab-category-diagram" data-category="diagram">
                <span class="material-symbols-rounded menu-item__icon">account_tree</span>
                <span class="menu-item__text">Diagramas y Esquemas</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'doc' ? ' is-active' : ''}" data-ref="tab-category-doc" data-category="doc">
                <span class="material-symbols-rounded menu-item__icon">description</span>
                <span class="menu-item__text">Documento Doc</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-top-left" data-ref="modal-body-top-left">
              <h2 class="component-top-title" data-ref="modal-body-title">Pizarrón Infinito</h2>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            ${templateVariants ? `
            <div class="modal-canvas-panel" data-ref="panel-category-template" style="${activeCategory === 'template' ? '' : 'display: none;'}">
              <div class="creation-category-section" data-ref="section-template-variants">
                <h3 class="creation-category-section__title">Resoluciones disponibles de la plantilla</h3>
                <div class="creation-cards-grid" data-ref="grid-template-variants">
                  ${templateVariants.map((v) => `
                    <button type="button" class="creation-card" data-ref="card-template-${v.width}x${v.height}" data-type="template-variant" data-w="${v.width}" data-h="${v.height}" data-img="${v.imagePath || ''}">
                      <div class="creation-card__thumbnail" data-ref="thumb-card-tpl-${v.width}">
                        <div class="creation-card__svg-wrapper" data-ref="svg-card-tpl-${v.width}">
                          ${getTemplateVariantSvg(v.width, v.height, v.imagePath)}
                        </div>
                        <span class="creation-card__badge" data-ref="badge-card-tpl-${v.width}">${v.width} × ${v.height} px</span>
                      </div>
                      <div class="creation-card__info" data-ref="info-card-tpl-${v.width}">
                        <h4 class="creation-card__title" data-ref="title-card-tpl-${v.width}">${v.label || `${v.width} × ${v.height} px`}</h4>
                        <p class="creation-card__meta" data-ref="meta-card-tpl-${v.width}">Plantilla de lienzo</p>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
            ` : ''}

            <div class="modal-canvas-panel" data-ref="panel-category-board" style="${activeCategory === 'board' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-boards">
                <button type="button" class="creation-card" data-ref="card-board-dots" data-type="board" data-bg="dots" data-color="#ffffff">
                  <div class="creation-card__thumbnail" data-ref="thumb-board-dots">
                    <div class="creation-card__svg-wrapper" data-ref="svg-board-dots">
                      ${getBoardSvg('dots')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-board-dots">Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-board-dots">
                    <h4 class="creation-card__title" data-ref="title-board-dots">Pizarrón Infinito</h4>
                    <p class="creation-card__meta" data-ref="meta-board-dots">Fondo blanco • Cuadrícula de puntos</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-diagram" style="${activeCategory === 'diagram' ? '' : 'display: none;'}">
              <div class="template-variants-pills" data-ref="diagram-category-pills" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; width: 100%;">
                ${DIAGRAM_CATEGORIES.map((cat) => `
                  <button type="button" class="template-variant-pill${cat.id === 'all' ? ' is-active' : ''}" data-ref="btn-diag-cat-${cat.id}" data-category="${cat.id}">
                    <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">${cat.icon}</span>
                    <span>${cat.name}</span>
                  </button>
                `).join('')}
              </div>

              <div class="creation-cards-grid" data-ref="grid-diagrams">
                ${DIAGRAM_SUBTYPES.map((sub) => `
                  <button type="button" class="creation-card" data-ref="card-diagram-${sub.id}" data-type="diagram" data-subtype="${sub.id}" data-category="${sub.category}">
                    <div class="creation-card__thumbnail" data-ref="thumb-diag-${sub.id}">
                      <div class="creation-card__svg-wrapper" data-ref="svg-diag-${sub.id}">
                        ${getDiagramSvg(sub.id)}
                      </div>
                      ${sub.badge ? `<span class="creation-card__badge ${sub.badge === 'Popular' ? 'creation-card__badge--popular' : ''}" data-ref="badge-diag-${sub.id}">${sub.badge}</span>` : ''}
                    </div>
                    <div class="creation-card__info" data-ref="info-diag-${sub.id}">
                      <h4 class="creation-card__title" data-ref="title-diag-${sub.id}">${sub.name}</h4>
                      <p class="creation-card__meta" data-ref="meta-diag-${sub.id}">${sub.description}</p>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-doc" style="${activeCategory === 'doc' ? '' : 'display: none;'}">
              <div class="creation-category-section" data-ref="section-doc-paper-sizes">
                <h3 class="creation-category-section__title">Formatos de papel estándar</h3>
                <div class="creation-cards-grid" data-ref="grid-doc-papers">
                  <button type="button" class="creation-card" data-ref="card-doc-digital" data-type="doc" data-paper="digital" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-digital">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-digital">
                        ${getDocSvg('digital')}
                      </div>
                      <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-doc-digital">Recomendado</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-digital">
                      <h4 class="creation-card__title" data-ref="title-doc-digital">Doc (Digital)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-digital">Lienzo continuo adaptable</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a4" data-type="doc" data-paper="a4" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a4">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a4">
                        ${getDocSvg('a4')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a4">ISO 216</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a4">
                      <h4 class="creation-card__title" data-ref="title-doc-a4">Doc (A4)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a4">21 × 29.7 cm • Informes y cartas</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-letter" data-type="doc" data-paper="letter" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-letter">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-letter">
                        ${getDocSvg('letter')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-letter">Carta</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-letter">
                      <h4 class="creation-card__title" data-ref="title-doc-letter">Doc (Carta)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-letter">8.5 × 11 in • Estándar América</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a3" data-type="doc" data-paper="a3" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a3">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a3">
                        ${getDocSvg('a3')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a3">Gran Formato</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a3">
                      <h4 class="creation-card__title" data-ref="title-doc-a3">Doc (A3)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a3">29.7 × 42 cm • Tablas y esquemas</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-legal" data-type="doc" data-paper="legal" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-legal">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-legal">
                        ${getDocSvg('legal')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-legal">Legal</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-legal">
                      <h4 class="creation-card__title" data-ref="title-doc-legal">Doc (Oficio)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-legal">8.5 × 14 in • Contratos y acuerdos</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a5" data-type="doc" data-paper="a5" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a5">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a5">
                        ${getDocSvg('a5')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a5">Compacto</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a5">
                      <h4 class="creation-card__title" data-ref="title-doc-a5">Doc (A5)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a5">14.8 × 21 cm • Folletos y notas</p>
                    </div>
                  </button>
                </div>
              </div>


            </div>

            <div class="banner banner--danger" data-ref="create-canvas-error" style="display: none; margin-top: 14px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  translateElement(backdrop);
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const categoryTitles: Record<string, string> = {
    board: 'Pizarrón Infinito',
    diagram: 'Diagramas y Esquemas',
    doc: 'Documento Doc',
    template: templateName ? `Plantilla: ${templateName}` : 'Plantilla',
  };

  const navItems = backdrop.querySelectorAll<HTMLElement>('[data-category]');
  const panels = backdrop.querySelectorAll<HTMLElement>('[data-ref^="panel-category-"]');
  const bodyTitle = backdrop.querySelector<HTMLElement>('[data-ref="modal-body-title"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');
  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');

  const switchCategory = (category: 'board' | 'diagram' | 'doc' | 'template') => {
    activeCategory = category;
    navItems.forEach((item) => {
      item.classList.toggle('is-active', item.getAttribute('data-category') === category);
    });

    panels.forEach((p) => {
      p.style.display = 'none';
    });

    const activePanel = backdrop.querySelector<HTMLElement>(`[data-ref="panel-category-${category}"]`);
    if (activePanel) {
      activePanel.style.display = 'block';
    }

    if (bodyTitle && categoryTitles[category]) {
      bodyTitle.textContent = categoryTitles[category];
    }
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  };

  if (bodyTitle && categoryTitles[activeCategory]) {
    bodyTitle.textContent = categoryTitles[activeCategory];
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const cat = item.getAttribute('data-category') as 'board' | 'diagram' | 'doc' | 'template';
      if (cat) {
        switchCategory(cat);
      }
    });
  });

  const categoryPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-diag-cat-"]');
  const diagramCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-diagram-"]');

  categoryPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-category') as DiagramCategory;
      categoryPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');

      diagramCards.forEach((card) => {
        const cardCat = card.getAttribute('data-category') as DiagramCategory;
        if (cat === 'all' || cardCat === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  const handleInstantCreation = async (optionsToCreate: CreateCanvasOptions, triggerButton?: HTMLElement | null) => {
    if (isCreating) return;
    isCreating = true;

    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
    if (triggerButton) {
      triggerButton.classList.add('is-loading');
    }

    try {
      await createAndOpenCanvas({
        ...optionsToCreate,
        effectiveTier: options?.teamUuid ? 'business' : null,
        teamUuid: options?.teamUuid || null,
      });
      closeModal();
    } catch (err: unknown) {
      isCreating = false;
      if (triggerButton) {
        triggerButton.classList.remove('is-loading');
      }
      const msg = err instanceof Error ? err.message : t('canvas.error_save');
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = 'block';
      }
    }
  };

  const boardCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-board-"]');
  boardCards.forEach((card) => {
    card.addEventListener('click', () => {
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        name: 'Pizarrón sin título',
        solidColor: '#ffffff',
      }, card);
    });
  });

  diagramCards.forEach((card) => {
    card.addEventListener('click', () => {
      const subtype = (card.getAttribute('data-subtype') as DiagramSubtype) || 'mindmap';
      const subtypeInfo = DIAGRAM_SUBTYPES.find((s) => s.id === subtype);
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        diagramSubtype: subtype,
        mindmapLineStyle: 'curved',
        name: subtypeInfo?.name ? `${subtypeInfo.name} sin título` : 'Mapa Mental sin título',
        rootIdeaText: subtypeInfo?.name || 'Idea Principal',
        solidColor: '#ffffff',
      }, card);
    });
  });

  const docCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-doc-"]');
  docCards.forEach((card) => {
    card.addEventListener('click', () => {
      const paper = (card.getAttribute('data-paper') as DocPaperSize) || 'letter';
      const templateId = card.getAttribute('data-template') || 'blank';
      const name = `Documento ${paper.toUpperCase()}`;
      void handleInstantCreation({
        canvasType: 'doc',
        docOrientation: 'portrait',
        docPaperSize: paper,
        docTemplateId: templateId,
        name,
      }, card);
    });
  });

  const templateVariantCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-template-"]');
  templateVariantCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '64', 10);
      const h = parseInt(card.getAttribute('data-h') || '64', 10);
      const img = card.getAttribute('data-img') || templateImage || null;
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        height: h,
        name: templateName || `Pizarrón ${w}×${h}`,
        pixelGrid: { backgroundColor: 'transparent', gridHeight: h, gridWidth: w, pixelSize: 16 },
        templateImage: img,
        width: w,
      }, card);
    });
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdrop) {
      closeModal();
    }
  };

  const closeModal = () => {
    window.removeEventListener('keydown', handleKeyDown);
    backdrop.removeEventListener('click', handleBackdropClick);
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      backdrop.remove();
      if (activeCreateCanvasModal && activeCreateCanvasModal.close === closeModal) {
        activeCreateCanvasModal = null;
      }
    }, 200);
  };

  btnClose?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', handleBackdropClick);
  window.addEventListener('keydown', handleKeyDown);

  activeCreateCanvasModal = { close: closeModal };
}

