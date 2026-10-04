import { showPromptModal } from '../../components/modal.component.js';
import { BoardProject, TEXT_PRESETS } from '../../core/canvas-engine.js';
import { escapeHtml } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { MindMapProject } from '../../types/mindmap.types.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { insertDocTable, setupTablePickerGrid } from './doc-table.manager.js';
import { DocPage, DocProject, DocTemplatePreset } from './doc.types.js';

export const INSPIRING_QUOTES = [
  '«El secreto para salir adelante es simplemente comenzar.» — Mark Twain',
  '«La creatividad es la inteligencia divirtiéndose.» — Albert Einstein',
  '«La simplicidad es la máxima sofisticación.» — Leonardo da Vinci',
  '«Haz de cada día tu obra maestra.» — John Wooden',
  '«La mejor forma de predecir el futuro es crearlo.» — Peter Drucker',
  '«Escribe algo que valga la pena leer o haz algo que valga la pena escribir.» — Benjamin Franklin',
  '«Todo parece imposible hasta que se hace.» — Nelson Mandela',
  '«Lo que no se empieza hoy nunca se termina mañana.» — Johann Wolfgang von Goethe',
];

export const SPECIAL_SYMBOLS = [
  '©', '®', '™', '§', '¶', '†', '‡', '•', '–', '—',
  '€', '$', '£', '¥', '₹', '¢', '°', '±', '×', '÷',
  '≠', '≤', '≥', '≈', '∞', '√', '∑', '∏', 'π', 'µ',
  'α', 'β', 'γ', 'δ', 'θ', 'λ', 'σ', 'ω', 'Δ', 'Ω',
  '→', '←', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★',
];

export function getRandomInspiringQuote(): string {
  return INSPIRING_QUOTES[Math.floor(Math.random() * INSPIRING_QUOTES.length)] || INSPIRING_QUOTES[0];
}

export function isDocDocumentEmpty(project: DocProject): boolean {
  if (!project?.pages || project.pages.length === 0) return true;
  if (project.pages.length > 1) return false;
  const firstPage = project.pages[0];
  if (!firstPage) return true;
  const content = firstPage.contentHtml || '';
  const temp = document.createElement('div');
  temp.innerHTML = content;
  const hasMedia = temp.querySelector('img, table, hr, iframe, .doc-image-wrapper, .doc-table') !== null;
  if (hasMedia) return false;
  const text = (temp.textContent || '').replace(/[\s\u200B\u00A0]+/g, '').trim();
  return text.length === 0;
}

export function insertDocAiGeneratedHtml(
  container: HTMLElement,
  html: string,
  callbacks: {
    onRecordChange: () => void;
    onUpdateEmptyPlaceholder: () => void;
    onUpdateStats: () => void;
  }
): void {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    document.execCommand('insertHTML', false, html);
  } else {
    const activeContent = container.querySelector<HTMLElement>('.doc-page__content:focus') ||
      container.querySelector<HTMLElement>('.doc-page__content');
    if (activeContent) {
      if (activeContent.innerHTML.trim() === '<p><br></p>' || activeContent.innerHTML.trim() === '') {
        activeContent.innerHTML = html;
      } else {
        activeContent.insertAdjacentHTML('beforeend', html);
      }
    }
  }
  callbacks.onUpdateEmptyPlaceholder();
  callbacks.onUpdateStats();
  callbacks.onRecordChange();
}

export function insertDocShapeSvg(
  pathD: string,
  name: string,
  color: string,
  insertImageElement: (src: string, initialWidth?: string, altText?: string) => void
): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="160" height="160"><path d="${pathD}" fill="${color}" /></svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  insertImageElement(dataUrl, '160px', name);
}

export function insertDocTextPreset(
  type: 'heading' | 'subheading' | 'body',
  insertAiGeneratedHtml: (html: string) => void
): void {
  const html = {
    body: `<p>${TEXT_PRESETS.body.text}</p>`,
    heading: `<h1>${TEXT_PRESETS.heading.text}</h1>`,
    subheading: `<h3>${TEXT_PRESETS.subheading.text}</h3>`,
  }[type];
  insertAiGeneratedHtml(html);
  showToast(type === 'heading' ? 'Título añadido' : type === 'subheading' ? 'Subtítulo añadido' : 'Texto añadido', 'success');
}

export function applyDocTemplateAsNewPage(
  container: HTMLElement,
  project: DocProject,
  paginationManager: DocPaginationManager,
  preset: DocTemplatePreset,
  callbacks: {
    onRecordChange: () => void;
    onRenderDocument: () => void;
  }
): void {
  const templateContent = preset.initialPages?.[0]?.contentHtml || '<p><br></p>';
  const newPage = paginationManager.addPage(project);
  newPage.contentHtml = templateContent;
  callbacks.onRenderDocument();
  callbacks.onRecordChange();

  const newPageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
  if (newPageEl) {
    newPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const contentEl = newPageEl.querySelector<HTMLElement>('.doc-page__content');
    contentEl?.focus();
  }
}

export function applyDocTemplateToCurrentPage(
  container: HTMLElement,
  project: DocProject,
  paginationManager: DocPaginationManager,
  lastActivePageId: string | null,
  preset: DocTemplatePreset,
  callbacks: {
    onRecordChange: () => void;
    onRenderDocument: () => void;
  }
): void {
  const templateContent = preset.initialPages?.[0]?.contentHtml || '<p><br></p>';
  let targetPage = project.pages.find((p) => p.id === lastActivePageId);
  if (!targetPage) {
    targetPage = project.pages[0];
  }
  if (!targetPage) {
    targetPage = paginationManager.addPage(project);
  }
  targetPage.contentHtml = templateContent;
  callbacks.onRenderDocument();
  callbacks.onRecordChange();

  const targetPageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${targetPage.id}"]`);
  if (targetPageEl) {
    targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const contentEl = targetPageEl.querySelector<HTMLElement>('.doc-page__content');
    contentEl?.focus();
  }
}

export function applyDocTemplateToDocument(
  project: DocProject,
  preset: DocTemplatePreset,
  callbacks: {
    onRecordChange: () => void;
    onRenderDocument: () => void;
  }
): void {
  project.pages = preset.initialPages.map((p) => ({
    contentHtml: p.contentHtml,
    id: `page_${crypto.randomUUID().slice(0, 8)}`,
  }));
  if (preset.settings) {
    if (preset.settings.fontFamily) project.settings.fontFamily = preset.settings.fontFamily;
    if (preset.settings.fontSize) project.settings.fontSize = preset.settings.fontSize;
    if (preset.settings.lineHeight) project.settings.lineHeight = preset.settings.lineHeight;
    if (preset.settings.margins) project.settings.margins = { ...preset.settings.margins };
    if (preset.settings.orientation) project.settings.orientation = preset.settings.orientation;
    if (preset.settings.paperSize) project.settings.paperSize = preset.settings.paperSize;
    if (preset.settings.showPageNumbers !== undefined) project.settings.showPageNumbers = preset.settings.showPageNumbers;
    if (preset.settings.headerText !== undefined) project.settings.headerText = preset.settings.headerText;
    if (preset.settings.footerText !== undefined) project.settings.footerText = preset.settings.footerText;
  }
  callbacks.onRenderDocument();
  callbacks.onRecordChange();
}

export function insertDocPageContent(
  container: HTMLElement,
  project: DocProject,
  paginationManager: DocPaginationManager,
  lastActivePageId: string | null,
  page: DocPage,
  mode: 'current_page' | 'new_page',
  callbacks: {
    onRecordChange: () => void;
    onRenderDocument: () => void;
  }
): void {
  const content = page.contentHtml || '<p><br></p>';
  if (mode === 'current_page') {
    let targetPage = project.pages.find((p) => p.id === lastActivePageId);
    if (!targetPage) {
      targetPage = project.pages[0];
    }
    if (!targetPage) {
      targetPage = paginationManager.addPage(project);
    }
    targetPage.contentHtml = content;
    callbacks.onRenderDocument();
    callbacks.onRecordChange();
    const targetPageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${targetPage.id}"]`);
    if (targetPageEl) {
      targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const contentEl = targetPageEl.querySelector<HTMLElement>('.doc-page__content');
      contentEl?.focus();
    }
  } else {
    const newPage = paginationManager.addPage(project);
    newPage.contentHtml = content;
    callbacks.onRenderDocument();
    callbacks.onRecordChange();
    const newPageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
    if (newPageEl) {
      newPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const contentEl = newPageEl.querySelector<HTMLElement>('.doc-page__content');
      contentEl?.focus();
    }
  }
}

export function insertDiagramAsDocOutline(
  diagram: MindMapProject,
  title: string,
  insertDocPage: (page: DocPage, mode: 'current_page' | 'new_page') => void
): void {
  if (!diagram || !diagram.nodes) return;
  const nodes = diagram.nodes;
  const rootNode = diagram.rootId && nodes[diagram.rootId] ? nodes[diagram.rootId] : Object.values(nodes).find((n) => !n.parentId);
  const mainTitle = rootNode ? rootNode.text : title;

  let html = `<h1>${escapeHtml(mainTitle)}</h1>`;

  const childMap = new Map<string, string[]>();
  Object.values(nodes).forEach((n) => {
    if (n.parentId) {
      if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
      childMap.get(n.parentId)!.push(n.id);
    }
  });

  const rootId = rootNode?.id || '';
  const level1Ids = rootId && childMap.has(rootId) ? childMap.get(rootId)! : Object.values(nodes).filter((n) => n.id !== rootId && !n.parentId).map((n) => n.id);

  if (level1Ids.length === 0) {
    Object.values(nodes).forEach((n) => {
      if (n.id !== rootId) {
        html += `<p>${escapeHtml(n.text)}</p>`;
      }
    });
  } else {
    level1Ids.forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      html += `<h2>${escapeHtml(node.text)}</h2>`;
      const subIds = childMap.get(id) || [];
      if (subIds.length > 0) {
        html += '<ul>';
        subIds.forEach((sid) => {
          const sub = nodes[sid];
          if (sub) {
            html += `<li>${escapeHtml(sub.text)}`;
            const deepIds = childMap.get(sid) || [];
            if (deepIds.length > 0) {
              html += '<ul>';
              deepIds.forEach((did) => {
                const deep = nodes[did];
                if (deep) html += `<li>${escapeHtml(deep.text)}</li>`;
              });
              html += '</ul>';
            }
            html += '</li>';
          }
        });
        html += '</ul>';
      }
    });
  }

  insertDocPage({ contentHtml: html, id: `page_${crypto.randomUUID().slice(0, 8)}` }, 'new_page');
}

export function insertBoardAsDocContent(
  board: BoardProject,
  title: string,
  insertDocPage: (page: DocPage, mode: 'current_page' | 'new_page') => void
): void {
  if (!board || !board.elements) return;
  let html = `<h1>${escapeHtml(title)}</h1>`;

  const stickies = board.elements.filter((el) => el.type === 'sticky') as any[];
  const texts = board.elements.filter((el) => el.type === 'text') as any[];

  if (stickies.length > 0) {
    html += '<h2>Notas y Puntos Clave</h2>';
    stickies.forEach((s) => {
      if (s.text) {
        html += `<blockquote><strong>Nota:</strong> ${escapeHtml(s.text)}</blockquote>`;
      }
    });
  }

  if (texts.length > 0) {
    html += '<h2>Textos del Pizarrón</h2>';
    texts.forEach((t) => {
      if (t.text) {
        html += `<p>${escapeHtml(t.text)}</p>`;
      }
    });
  }

  if (stickies.length === 0 && texts.length === 0) {
    html += '<p>Contenido importado del pizarrón.</p>';
  }

  insertDocPage({ contentHtml: html, id: `page_${crypto.randomUUID().slice(0, 8)}` }, 'new_page');
}

export function setupDocInsertTools(options: {
  container: HTMLElement;
  formattingManager: () => { docToolsDropdownController?: { close: () => void } | null; insertMoreDropdownController?: { close: () => void } | null } | null;
  getSelectedImageWrapper: () => HTMLElement | null;
  insertImageElement: (src: string) => void;
  modalsManager: () => { openStatsModal: () => void } | null;
  onRecordChange: () => void;
  onRenderDocument: () => void;
  paginationManager: DocPaginationManager;
  project: DocProject;
  signal: AbortSignal;
}): void {
  const {
    container,
    formattingManager,
    getSelectedImageWrapper,
    insertImageElement,
    modalsManager,
    onRecordChange,
    onRenderDocument,
    paginationManager,
    project,
    signal,
  } = options;

  const btnInsertImg = container.querySelector<HTMLElement>('[data-ref="btn-insert-image"]');
  const fileInputImg = container.querySelector<HTMLInputElement>('[data-ref="input-file-image"]');
  const fileInputReplaceImg = container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');

  if (btnInsertImg && fileInputImg) {
    btnInsertImg.addEventListener('click', () => fileInputImg.click(), { signal });
    fileInputImg.addEventListener('change', async () => {
      const file = fileInputImg.files?.[0];
      if (!file) return;
      const validation = validateAndSanitizeFile(file, { maxMb: 10 });
      if (!validation.valid || !validation.file) {
        showToast(validation.error || 'Archivo de imagen no válido.', 'error');
        fileInputImg.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) insertImageElement(dataUrl);
      };
      reader.readAsDataURL(validation.file);
      fileInputImg.value = '';
    }, { signal });
  }

  if (fileInputReplaceImg) {
    fileInputReplaceImg.addEventListener('change', () => {
      const file = fileInputReplaceImg.files?.[0];
      const selected = getSelectedImageWrapper();
      if (!file || !selected) return;
      const validation = validateAndSanitizeFile(file, { maxMb: 10 });
      if (!validation.valid || !validation.file) {
        showToast(validation.error || 'Archivo de imagen no válido.', 'error');
        fileInputReplaceImg.value = '';
        return;
      }
      const img = selected.querySelector('img');
      if (!img) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          img.src = dataUrl;
          onRecordChange();
          showToast('Imagen reemplazada con éxito', 'success');
        }
      };
      reader.readAsDataURL(validation.file);
      fileInputReplaceImg.value = '';
    }, { signal });
  }

  setupTablePickerGrid({
    container,
    onInsert: (r, c) => insertDocTable(r, c, onRecordChange),
    signal,
  });

  container.querySelectorAll<HTMLElement>('[data-ref^="opt-callout-"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type') || 'info';
      const colors: Record<string, { bg: string; border: string; color: string; icon: string; title: string }> = {
        danger: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: 'dangerous', title: 'Peligro' },
        info: { bg: '#eff6ff', border: '#3b82f6', color: '#1e3a8a', icon: 'info', title: 'Nota informativa' },
        success: { bg: '#f0fdf4', border: '#22c55e', color: '#14532d', icon: 'check_circle', title: 'Éxito' },
        tip: { bg: '#faf5ff', border: '#a855f7', color: '#581c87', icon: 'lightbulb', title: 'Consejo' },
        warning: { bg: '#fffbeb', border: '#f59e0b', color: '#78350f', icon: 'warning', title: 'Advertencia' },
      };
      const conf = colors[type] || colors.info;
      const html = `
        <div class="doc-callout doc-callout--${type}" style="background: ${conf.bg}; border-left: 4px solid ${conf.border}; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${conf.border}; margin-bottom: 4px;">
            <span class="component-icon" style="font-size: 18px;">${conf.icon}</span> ${conf.title}
          </div>
          <p style="margin: 0; color: ${conf.color}; font-size: 10.5pt; line-height: 1.5;">Escribe aquí el contenido relevante de la nota o aviso.</p>
        </div>
        <p><br></p>
      `;
      document.execCommand('insertHTML', false, html);
      formattingManager()?.insertMoreDropdownController?.close();
      onRecordChange();
    }, { signal });
  });

  const btnInsertLink = container.querySelector<HTMLElement>('[data-ref="btn-insert-link"]');
  if (btnInsertLink) {
    btnInsertLink.addEventListener('click', async () => {
      const url = await showPromptModal({
        defaultValue: 'https://',
        inputType: 'url',
        title: 'Introduce la dirección URL del enlace:',
      });
      if (url) {
        document.execCommand('createLink', false, url);
        onRecordChange();
      }
    }, { signal });
  }

  const btnAddPage = container.querySelector<HTMLElement>('[data-ref="btn-add-page"]');
  if (btnAddPage) {
    btnAddPage.addEventListener('click', () => {
      paginationManager.addPage(project);
      onRenderDocument();
      formattingManager()?.insertMoreDropdownController?.close();
      onRecordChange();
      showToast('Nueva página añadida al documento', 'success');
    }, { signal });
  }

  const btnDocStats = container.querySelector<HTMLElement>('[data-ref="btn-doc-stats"]');
  if (btnDocStats) {
    btnDocStats.addEventListener('click', () => {
      formattingManager()?.docToolsDropdownController?.close();
      modalsManager()?.openStatsModal();
    }, { signal });
  }
}
