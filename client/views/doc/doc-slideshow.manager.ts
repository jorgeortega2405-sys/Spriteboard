import { DOC_PAPER_DIMENSIONS, DocProject } from './doc.types.js';
import { escapeHtml } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';

export function startDocSlideshow(project: DocProject, canvasTitle: string, startPageIndex = 0): void {
  if (!project.pages || project.pages.length === 0) {
    showToast('No hay diapositivas para presentar.', 'info');
    return;
  }

  const totalSlides = project.pages.length;
  let currentSlide = Math.max(0, Math.min(startPageIndex, totalSlides - 1));

  const overlay = document.createElement('div');
  overlay.className = 'doc-slideshow-overlay';
  overlay.setAttribute('data-ref', 'doc-slideshow-overlay');

  const paperSizeKey = project.settings.paperSize || 'letter';
  const orientationKey = project.settings.orientation || 'portrait';
  const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
    ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
    : DOC_PAPER_DIMENSIONS.letter.portrait;

  const slideWidth = paper.widthPx > 0 ? paper.widthPx : 816;
  const slideHeight = paper.heightPx > 0 ? paper.heightPx : 1056;
  const margins = project.settings.margins || { bottom: 48, left: 60, right: 60, top: 48 };

  overlay.innerHTML = `
    <div class="doc-slideshow__bar" data-ref="slideshow-bar">
      <div class="doc-slideshow__bar-left">
        <span class="doc-slideshow__title">${escapeHtml(canvasTitle)}</span>
      </div>
      <div class="doc-slideshow__bar-center">
        <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-prev" data-tooltip="Anterior (←)" aria-label="Diapositiva anterior">
          <span class="component-icon">arrow_back</span>
        </button>
        <span class="doc-slideshow__counter" data-ref="slideshow-counter">1 / ${totalSlides}</span>
        <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-next" data-tooltip="Siguiente (→)" aria-label="Siguiente diapositiva">
          <span class="component-icon">arrow_forward</span>
        </button>
      </div>
      <div class="doc-slideshow__bar-right">
        <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-fullscreen" data-tooltip="Pantalla completa (F)" aria-label="Pantalla completa">
          <span class="component-icon">fullscreen</span>
        </button>
        <button type="button" class="doc-slideshow__nav-btn doc-slideshow__nav-btn--close" data-ref="btn-slideshow-close" data-tooltip="Salir (Esc)" aria-label="Salir de presentación">
          <span class="component-icon">close</span>
        </button>
      </div>
    </div>
    <div class="doc-slideshow__stage" data-ref="slideshow-stage">
      <div class="doc-slideshow__viewport" data-ref="slideshow-viewport">
        <div class="doc-slideshow__slide-wrapper doc-page--theme-${project.settings.pageColor || 'white'}" data-ref="slideshow-slide-wrapper">
          <div class="doc-slideshow__slide-content" data-ref="slideshow-slide-content"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('slideshow-active');

  const counterEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-counter"]');
  const contentEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-slide-content"]');
  const slideWrapper = overlay.querySelector<HTMLElement>('[data-ref="slideshow-slide-wrapper"]');
  const btnPrev = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-prev"]');
  const btnNext = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-next"]');
  const btnFullscreen = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-fullscreen"]');
  const btnClose = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-close"]');
  const stageEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-stage"]');

  if (slideWrapper) {
    slideWrapper.style.width = `${slideWidth}px`;
    slideWrapper.style.height = `${slideHeight}px`;
    slideWrapper.style.paddingTop = `${margins.top}px`;
    slideWrapper.style.paddingRight = `${margins.right}px`;
    slideWrapper.style.paddingBottom = `${margins.bottom}px`;
    slideWrapper.style.paddingLeft = `${margins.left}px`;
    slideWrapper.style.fontFamily = project.settings.fontFamily;
    slideWrapper.style.fontSize = `${project.settings.fontSize || 16}pt`;
    slideWrapper.style.lineHeight = `${project.settings.lineHeight || 1.4}`;
  }

  const fitSlide = () => {
    if (!slideWrapper) return;
    const stageW = window.innerWidth;
    const stageH = window.innerHeight - 56;
    const scaleX = (stageW - 40) / slideWidth;
    const scaleY = (stageH - 40) / slideHeight;
    const scale = Math.min(scaleX, scaleY, 2.0);
    slideWrapper.style.transform = `scale(${Math.max(0.2, scale)})`;
  };

  const renderSlide = (index: number) => {
    currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
    const page = project.pages[currentSlide];
    if (contentEl && page) {
      contentEl.innerHTML = page.contentHtml || '';
    }
    if (counterEl) {
      counterEl.textContent = `${currentSlide + 1} / ${totalSlides}`;
    }
    if (btnPrev) btnPrev.classList.toggle('is-disabled', currentSlide === 0);
    if (btnNext) btnNext.classList.toggle('is-disabled', currentSlide === totalSlides - 1);
  };

  fitSlide();
  renderSlide(currentSlide);
  window.addEventListener('resize', fitSlide);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      renderSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      renderSlide(currentSlide - 1);
    }
  };

  btnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    nextSlide();
  });
  btnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    prevSlide();
  });

  stageEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) return;
    const clickX = e.clientX;
    if (clickX < window.innerWidth * 0.3) {
      prevSlide();
    } else {
      nextSlide();
    }
  });

  btnFullscreen?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      overlay.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  const closeSlideshow = () => {
    window.removeEventListener('resize', fitSlide);
    window.removeEventListener('keydown', handleKey);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    overlay.remove();
    document.body.classList.remove('slideshow-active');
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSlideshow();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      renderSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      renderSlide(totalSlides - 1);
    } else if (e.key.toLowerCase() === 'f') {
      if (!document.fullscreenElement) {
        overlay.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  btnClose?.addEventListener('click', closeSlideshow);
  window.addEventListener('keydown', handleKey);
}
