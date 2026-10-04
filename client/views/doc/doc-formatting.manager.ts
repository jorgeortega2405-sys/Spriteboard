import { showPromptModal } from '../../components/modal.component.js';
import { showToast } from '../../services/toast.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { DocFontPickerComponent, FontSelectEvent } from './doc-font-picker.component.js';
import { ensureGoogleFontLoaded } from './doc-fonts.config.js';
import { DocProject } from './doc.types.js';

export const PALETTE_COLORS = [
  '#000000', '#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

export interface DocFormattingOptions {
  container: HTMLElement;
  onHandleContextMenu?: (e: MouseEvent) => void;
  onRecordChange: () => void;
  onRenderDocument: () => void;
  project: DocProject;
  signal: AbortSignal;
}

export interface DocFormattingController {
  alignmentDropdownController: { close: () => void; destroy: () => void } | null;
  applyColor: (color: string) => void;
  applyFontSizeToSelection: (sizePt: number) => void;
  applyFontToDocumentOrSelection: (event: FontSelectEvent) => void;
  destroy: () => void;
  docToolsDropdownController: { close: () => void; destroy: () => void } | null;
  fontPicker: DocFontPickerComponent | null;
  indentsDropdownController: { close: () => void; destroy: () => void } | null;
  insertMoreDropdownController: { close: () => void; destroy: () => void } | null;
  lineSpacingDropdownController: { close: () => void; destroy: () => void } | null;
  moreFormattingDropdownController: { close: () => void; destroy: () => void } | null;
  stylesDropdownController: { close: () => void; destroy: () => void } | null;
  updateActiveFormattingButtons: () => void;
}

export function setupDocFormatting(options: DocFormattingOptions): DocFormattingController {
  const { container, project, signal, onRecordChange, onRenderDocument, onHandleContextMenu } = options;

  let currentColorTarget: 'highlight' | 'text' = 'text';
  let currentHighlightColor = '#fef08a';
  let currentTextColor = '#0f172a';
  let fontPicker: DocFontPickerComponent | null = null;

  let alignmentDropdownController: { close: () => void; destroy: () => void } | null = null;
  let docToolsDropdownController: { close: () => void; destroy: () => void } | null = null;
  let indentsDropdownController: { close: () => void; destroy: () => void } | null = null;
  let insertMoreDropdownController: { close: () => void; destroy: () => void } | null = null;
  let lineSpacingDropdownController: { close: () => void; destroy: () => void } | null = null;
  let moreFormattingDropdownController: { close: () => void; destroy: () => void } | null = null;
  let stylesDropdownController: { close: () => void; destroy: () => void } | null = null;

  const updateActiveFormattingButtons = (): void => {
    const updateActive = (ref: string, state: boolean) => {
      const el = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.classList.toggle('is-active', state);
    };

    const updateAlignmentIcon = (iconName: string) => {
      const iconEl = container.querySelector<HTMLElement>('[data-ref="alignment-current-icon"]');
      if (iconEl) iconEl.textContent = iconName;
    };

    try {
      updateActive('btn-bold', document.queryCommandState('bold'));
      updateActive('btn-italic', document.queryCommandState('italic'));
      updateActive('btn-underline', document.queryCommandState('underline'));
      updateActive('btn-strike', document.queryCommandState('strikeThrough'));
      updateActive('btn-superscript', document.queryCommandState('superscript'));
      updateActive('btn-subscript', document.queryCommandState('subscript'));
      updateActive('btn-align-left', document.queryCommandState('justifyLeft'));
      updateActive('btn-align-center', document.queryCommandState('justifyCenter'));
      updateActive('btn-align-right', document.queryCommandState('justifyRight'));
      updateActive('btn-align-justify', document.queryCommandState('justifyFull'));

      if (document.queryCommandState('justifyCenter')) {
        updateAlignmentIcon('format_align_center');
      } else if (document.queryCommandState('justifyRight')) {
        updateAlignmentIcon('format_align_right');
      } else if (document.queryCommandState('justifyFull')) {
        updateAlignmentIcon('format_align_justify');
      } else {
        updateAlignmentIcon('format_align_left');
      }
    } catch {}
  };

  const applyFontSizeToSelection = (sizePt: number): void => {
    project.settings.fontSize = sizePt;
    const fontSizeBadge = container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${sizePt}pt`;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      onRenderDocument();
      onRecordChange();
      return;
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${sizePt}pt`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    onRecordChange();
  };

  const applyFontToDocumentOrSelection = (event: FontSelectEvent): void => {
    const fullFamily = `'${event.family}', ${event.fallback}`;
    ensureGoogleFontLoaded(event.family);

    const lbl = container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (lbl) {
      lbl.textContent = event.family;
    }

    const sel = window.getSelection();
    let hasSelectionInDoc = false;

    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const element = common.nodeType === Node.ELEMENT_NODE ? (common as HTMLElement) : common.parentElement;

      if (element && element.closest('.doc-page__content')) {
        hasSelectionInDoc = true;
        const span = document.createElement('span');
        span.style.fontFamily = fullFamily;
        if (event.weight) {
          span.style.fontWeight = String(event.weight);
        }
        if (event.style) {
          span.style.fontStyle = event.style;
        }
        span.appendChild(range.extractContents());
        range.insertNode(span);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      }
    }

    if (!hasSelectionInDoc) {
      project.settings.fontFamily = fullFamily;
      container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((p) => {
        p.style.fontFamily = fullFamily;
      });
    }

    if (fontPicker) {
      fontPicker.setActiveFont(event.family, event.weight || 400, event.style || 'normal');
    }

    onRecordChange();
  };

  const applyColor = (color: string): void => {
    if (currentColorTarget === 'text') {
      currentTextColor = color;
      const indicator = container.querySelector<HTMLElement>('[data-ref="indicator-text-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('foreColor', false, color);
    } else {
      currentHighlightColor = color;
      const indicator = container.querySelector<HTMLElement>('[data-ref="indicator-bg-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('hiliteColor', false, color);
    }

    const customColorInput = container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (customColorInput) customColorInput.value = color;
    if (customHexInput) customHexInput.value = color.toUpperCase();
    if (customHexText) customHexText.textContent = color.toUpperCase();
    if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = color;

    onRecordChange();
  };

  const transformSelectedText = (fn: (text: string) => string): void => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const content = range.extractContents();
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = fn(node.nodeValue);
      node = walker.nextNode();
    }
    range.insertNode(content);
    onRecordChange();
  };

  const bindFormattingTools = (): void => {
    const bindCmd = (ref: string, command: string, value: string | undefined = undefined) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, value);
          updateActiveFormattingButtons();
          onRecordChange();
        }, { signal });
      }
    };

    bindCmd('btn-bold', 'bold');
    bindCmd('btn-italic', 'italic');
    bindCmd('btn-underline', 'underline');

    const bindMoreFormatCmd = (ref: string, command: string) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          moreFormattingDropdownController?.close();
          updateActiveFormattingButtons();
          onRecordChange();
        }, { signal });
      }
    };

    bindMoreFormatCmd('btn-strike', 'strikeThrough');
    bindMoreFormatCmd('btn-superscript', 'superscript');
    bindMoreFormatCmd('btn-subscript', 'subscript');

    const updateAlignmentIcon = (iconName: string) => {
      const iconEl = container.querySelector<HTMLElement>('[data-ref="alignment-current-icon"]');
      if (iconEl) iconEl.textContent = iconName;
    };

    const bindAlignmentCmd = (ref: string, command: string, iconName: string) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          updateAlignmentIcon(iconName);
          alignmentDropdownController?.close();
          updateActiveFormattingButtons();
          onRecordChange();
        }, { signal });
      }
    };

    bindAlignmentCmd('btn-align-left', 'justifyLeft', 'format_align_left');
    bindAlignmentCmd('btn-align-center', 'justifyCenter', 'format_align_center');
    bindAlignmentCmd('btn-align-right', 'justifyRight', 'format_align_right');
    bindAlignmentCmd('btn-align-justify', 'justifyFull', 'format_align_justify');

    bindCmd('btn-list-bullet', 'insertUnorderedList');
    bindCmd('btn-list-ordered', 'insertOrderedList');

    const bindIndentCmd = (ref: string, command: string) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          indentsDropdownController?.close();
          onRecordChange();
        }, { signal });
      }
    };

    bindIndentCmd('btn-outdent', 'outdent');
    bindIndentCmd('btn-indent', 'indent');

    const btnInsertHr = container.querySelector<HTMLElement>('[data-ref="btn-insert-hr"]');
    if (btnInsertHr) {
      btnInsertHr.addEventListener('click', (e) => {
        e.preventDefault();
        document.execCommand('insertHorizontalRule', false, undefined);
        insertMoreDropdownController?.close();
        onRecordChange();
      }, { signal });
    }

    const btnClearFormat = container.querySelector<HTMLElement>('[data-ref="btn-clear-format"]');
    if (btnClearFormat) {
      btnClearFormat.addEventListener('click', (e) => {
        e.preventDefault();
        document.execCommand('removeFormat', false, undefined);
        moreFormattingDropdownController?.close();
        onRecordChange();
        showToast('Formato limpiado', 'success');
      }, { signal });
    }

    const btnFirstLineIndent = container.querySelector<HTMLElement>('[data-ref="btn-indent-first-line"]');
    if (btnFirstLineIndent) {
      btnFirstLineIndent.addEventListener('click', (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          const el = (sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('p, div, h1, h2, h3, h4');
          if (el) {
            el.classList.toggle('doc-indent-first-line');
            onRecordChange();
          }
        }
        indentsDropdownController?.close();
      }, { signal });
    }

    const btnChecklist = container.querySelector<HTMLElement>('[data-ref="btn-list-checklist"]');
    if (btnChecklist) {
      btnChecklist.addEventListener('click', (e) => {
        e.preventDefault();
        const html = '<div class="doc-checklist-item" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 4px;" /><span>Tarea pendiente</span></div><p><br></p>';
        document.execCommand('insertHTML', false, html);
        indentsDropdownController?.close();
        onRecordChange();
      }, { signal });
    }

    const btnFontSizeMinus = container.querySelector<HTMLElement>('[data-ref="btn-font-size-minus"]');
    const btnFontSizePlus = container.querySelector<HTMLElement>('[data-ref="btn-font-size-plus"]');
    const btnFontSizeBadge = container.querySelector<HTMLElement>('[data-ref="btn-font-size-badge"]');

    if (btnFontSizeMinus) {
      btnFontSizeMinus.addEventListener('click', () => {
        const cur = Math.max(8, (project.settings.fontSize || 11) - 1);
        applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizePlus) {
      btnFontSizePlus.addEventListener('click', () => {
        const cur = Math.min(72, (project.settings.fontSize || 11) + 1);
        applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizeBadge) {
      btnFontSizeBadge.addEventListener('click', async () => {
        const val = await showPromptModal({
          defaultValue: String(project.settings.fontSize || 11),
          inputType: 'number',
          title: 'Tamaño de fuente (pt):',
        });
        const num = Number(val);
        if (num && num >= 6 && num <= 96) {
          applyFontSizeToSelection(num);
        }
      }, { signal });
    }

    document.addEventListener('selectionchange', () => {
      updateActiveFormattingButtons();
    }, { signal });
  };

  const bindDropdowns = (): void => {
    const wrapperStyles = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-styles"]');
    if (wrapperStyles) {
      stylesDropdownController = setupDropdown(wrapperStyles, { matchWidth: true });
    }

    container.querySelectorAll<HTMLElement>('[data-ref^="opt-style-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-command') || 'formatBlock';
        const tag = btn.getAttribute('data-value') || 'p';

        if (cmd === 'customStyle') {
          if (tag === 'title') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-title';
          } else if (tag === 'subtitle') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-subtitle';
          }
        } else {
          document.execCommand('formatBlock', false, tag);
        }

        const lbl = container.querySelector<HTMLElement>('[data-ref="lbl-current-style"]');
        if (lbl) lbl.textContent = btn.querySelector('.menu-item__text')?.textContent?.trim() || btn.textContent?.trim() || 'Texto normal';
        stylesDropdownController?.close();
        onRecordChange();
      }, { signal });
    });

    const wrapperMoreFormatting = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-more-formatting"]');
    if (wrapperMoreFormatting) {
      moreFormattingDropdownController = setupDropdown(wrapperMoreFormatting, { matchWidth: false });
    }

    const wrapperAlignment = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-alignment"]');
    if (wrapperAlignment) {
      alignmentDropdownController = setupDropdown(wrapperAlignment, { matchWidth: false });
    }

    const wrapperIndents = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-indents"]');
    if (wrapperIndents) {
      indentsDropdownController = setupDropdown(wrapperIndents, { matchWidth: false });
    }

    const wrapperInsertMore = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-insert-more"]');
    if (wrapperInsertMore) {
      insertMoreDropdownController = setupDropdown(wrapperInsertMore, { matchWidth: false });
    }

    const wrapperDocTools = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-doc-tools"]');
    if (wrapperDocTools) {
      docToolsDropdownController = setupDropdown(wrapperDocTools, { matchWidth: false });
    }

    container.querySelectorAll<HTMLElement>('[data-ref^="opt-letter-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = btn.getAttribute('data-letter-spacing') || '0px';
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.style.letterSpacing = spacing;
          span.appendChild(range.extractContents());
          range.insertNode(span);
        } else {
          project.settings.letterSpacing = parseFloat(spacing) || 0;
          onRenderDocument();
        }
        moreFormattingDropdownController?.close();
        onRecordChange();
      }, { signal });
    });

    container.querySelector<HTMLElement>('[data-ref="opt-case-upper"]')?.addEventListener('click', () => {
      transformSelectedText((t) => t.toUpperCase());
      moreFormattingDropdownController?.close();
    }, { signal });

    container.querySelector<HTMLElement>('[data-ref="opt-case-lower"]')?.addEventListener('click', () => {
      transformSelectedText((t) => t.toLowerCase());
      moreFormattingDropdownController?.close();
    }, { signal });

    container.querySelector<HTMLElement>('[data-ref="opt-case-title"]')?.addEventListener('click', () => {
      transformSelectedText((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));
      moreFormattingDropdownController?.close();
    }, { signal });

    const wrapperSpacing = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-line-spacing"]');
    if (wrapperSpacing) {
      lineSpacingDropdownController = setupDropdown(wrapperSpacing, { matchWidth: false });
    }

    container.querySelectorAll<HTMLElement>('[data-ref^="opt-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = Number(btn.getAttribute('data-spacing')) || 1.15;
        project.settings.lineHeight = spacing;
        lineSpacingDropdownController?.close();
        onRenderDocument();
        onRecordChange();
      }, { signal });
    });

    container.querySelector<HTMLElement>('[data-ref="opt-para-space-add"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '1.2em';
        lineSpacingDropdownController?.close();
        onRecordChange();
        showToast('Espacio añadido después del párrafo', 'success');
      }
    }, { signal });

    container.querySelector<HTMLElement>('[data-ref="opt-para-space-remove"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '0';
        lineSpacingDropdownController?.close();
        onRecordChange();
        showToast('Espacio removido del párrafo', 'success');
      }
    }, { signal });
  };

  const bindSelectionBubble = (): void => {
    const bubble = container.querySelector<HTMLElement>('[data-ref="doc-floating-bubble"]');
    if (!bubble) return;

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        bubble.classList.add('is-hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        bubble.style.top = `${window.scrollY + rect.top - 46}px`;
        bubble.style.left = `${window.scrollX + rect.left + rect.width / 2 - 100}px`;
        bubble.classList.remove('is-hidden');
      } else {
        bubble.classList.add('is-hidden');
      }
    }, { signal });

    const bindBubbleCmd = (ref: string, cmd: string, val: string | undefined = undefined) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(cmd, false, val);
          onRecordChange();
        }, { signal });
      }
    };

    bindBubbleCmd('bubble-btn-bold', 'bold');
    bindBubbleCmd('bubble-btn-italic', 'italic');
    bindBubbleCmd('bubble-btn-underline', 'underline');
    bindBubbleCmd('bubble-btn-h2', 'formatBlock', 'h2');
    bindBubbleCmd('bubble-btn-quote', 'formatBlock', 'blockquote');

    const bubbleLink = container.querySelector<HTMLElement>('[data-ref="bubble-btn-link"]');
    if (bubbleLink) {
      bubbleLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = await showPromptModal({
          defaultValue: 'https://',
          inputType: 'url',
          title: 'Introduce la dirección URL:',
        });
        if (url) {
          document.execCommand('createLink', false, url);
          onRecordChange();
        }
      }, { signal });
    }
  };

  const initSidePanelsUI = (): void => {
    const btnFontTrigger = container.querySelector<HTMLElement>('[data-ref="btn-trigger-font-family"]');
    const fontsPanel = container.querySelector<HTMLElement>('[data-ref="doc-fonts-panel"]');
    const btnCloseFonts = container.querySelector<HTMLElement>('[data-ref="btn-close-doc-fonts"]');
    const fontsBody = container.querySelector<HTMLElement>('[data-ref="doc-fonts-body"]');

    const btnTextColorTrigger = container.querySelector<HTMLElement>('[data-ref="btn-text-color-trigger"]');
    const btnBgColorTrigger = container.querySelector<HTMLElement>('[data-ref="btn-bg-color-trigger"]');
    const colorsPanel = container.querySelector<HTMLElement>('[data-ref="doc-colors-panel"]');
    const colorsTitle = container.querySelector<HTMLElement>('[data-ref="doc-colors-title"]');
    const btnCloseColors = container.querySelector<HTMLElement>('[data-ref="btn-close-doc-colors"]');
    const paletteGrid = container.querySelector<HTMLElement>('[data-ref="doc-palette-grid"]');
    const customColorInput = container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (fontsBody) {
      fontPicker = new DocFontPickerComponent(fontsBody, (event: FontSelectEvent) => {
        applyFontToDocumentOrSelection(event);
      });
      fontPicker.init(project.settings.fontFamily);
    }

    btnFontTrigger?.addEventListener('click', () => {
      if (fontsPanel?.classList.contains('is-hidden')) {
        colorsPanel?.classList.add('is-hidden');
        fontsPanel?.classList.remove('is-hidden');
        fontPicker?.focusSearch();
      } else {
        fontsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseFonts?.addEventListener('click', () => {
      fontsPanel?.classList.add('is-hidden');
    }, { signal });

    const updateColorPanelState = (target: 'highlight' | 'text') => {
      currentColorTarget = target;
      if (colorsTitle) {
        colorsTitle.textContent = target === 'text' ? 'Color de texto' : 'Color de resaltado';
      }
      const activeColor = target === 'text' ? currentTextColor : currentHighlightColor;
      if (customColorInput) customColorInput.value = activeColor;
      if (customHexInput) customHexInput.value = activeColor.toUpperCase();
      if (customHexText) customHexText.textContent = activeColor.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = activeColor;
    };

    btnTextColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || currentColorTarget !== 'text') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('text');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnBgColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || currentColorTarget !== 'highlight') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('highlight');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseColors?.addEventListener('click', () => {
      colorsPanel?.classList.add('is-hidden');
    }, { signal });

    if (paletteGrid) {
      paletteGrid.innerHTML = PALETTE_COLORS.map((c) => `
        <button type="button" class="design-colors-palette-swatch" data-color="${c}" style="background-color: ${c};" aria-label="Color ${c}"></button>
      `).join('');

      paletteGrid.querySelectorAll<HTMLElement>('[data-color]').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const color = swatch.getAttribute('data-color');
          if (color) {
            applyColor(color);
          }
        }, { signal });
      });
    }

    customColorInput?.addEventListener('input', () => {
      const val = customColorInput.value;
      if (customHexInput) customHexInput.value = val.toUpperCase();
      if (customHexText) customHexText.textContent = val.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
      applyColor(val);
    }, { signal });

    customHexInput?.addEventListener('change', () => {
      let val = customHexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        if (customColorInput) customColorInput.value = val;
        if (customHexText) customHexText.textContent = val.toUpperCase();
        if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
        applyColor(val);
      }
    }, { signal });

    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    viewport?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ref="doc-fonts-panel"], [data-ref="doc-colors-panel"], [data-ref="btn-trigger-font-family"], [data-ref="btn-text-color-trigger"], [data-ref="btn-bg-color-trigger"]')) {
        fontsPanel?.classList.add('is-hidden');
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    if (onHandleContextMenu) {
      viewport?.addEventListener('contextmenu', (e: MouseEvent) => {
        onHandleContextMenu(e);
      }, { signal });
    }
  };

  bindFormattingTools();
  bindDropdowns();
  bindSelectionBubble();
  initSidePanelsUI();

  const destroy = (): void => {
    alignmentDropdownController?.destroy();
    docToolsDropdownController?.destroy();
    indentsDropdownController?.destroy();
    insertMoreDropdownController?.destroy();
    lineSpacingDropdownController?.destroy();
    moreFormattingDropdownController?.destroy();
    stylesDropdownController?.destroy();
    if (fontPicker) {
      fontPicker.destroy();
      fontPicker = null;
    }
  };

  return {
    get alignmentDropdownController() { return alignmentDropdownController; },
    applyColor,
    applyFontSizeToSelection,
    applyFontToDocumentOrSelection,
    destroy,
    get docToolsDropdownController() { return docToolsDropdownController; },
    get fontPicker() { return fontPicker; },
    get indentsDropdownController() { return indentsDropdownController; },
    get insertMoreDropdownController() { return insertMoreDropdownController; },
    get lineSpacingDropdownController() { return lineSpacingDropdownController; },
    get moreFormattingDropdownController() { return moreFormattingDropdownController; },
    get stylesDropdownController() { return stylesDropdownController; },
    updateActiveFormattingButtons,
  };
}
