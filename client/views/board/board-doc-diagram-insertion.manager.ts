import { DEFAULT_STICKY_COLOR, DEFAULT_STICKY_TEXT_COLOR } from '../../config/sticky-notes.config.js';
import { BoardConnectorElement, BoardElement, BoardShapeElement, BoardStickyElement, BoardTextElement, screenToWorld, ShapeType } from '../../core/canvas-engine.js';
import { DocPage } from '../doc/doc.types.js';
import { BoardElementInsertionHost } from './board-element-insertion.manager.js';

export class BoardDocDiagramInsertionManager {
  private controller: BoardElementInsertionHost;

  constructor(controller: BoardElementInsertionHost) {
    this.controller = controller;
  }

  public insertDocAsBoardElements(pages: DocPage[], docTitle: string): void {
    if (!pages || pages.length === 0) return;
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const cardW = 440;
    const cardH = 580;
    const gap = 40;
    const totalW = pages.length * cardW + (pages.length - 1) * gap;
    const startX = Math.round(centerWorld.x - totalW / 2);
    const startY = Math.round(centerWorld.y - cardH / 2);

    const newElements: BoardElement[] = [];

    pages.forEach((page, pIdx) => {
      const pageX = startX + pIdx * (cardW + gap);
      const pageY = startY;
      const pageId = `page_card_${Date.now()}_${pIdx}_${Math.random().toString(36).slice(2, 6)}`;

      const sheetEl: BoardShapeElement = {
        fillColor: '#ffffff',
        height: cardH,
        id: pageId,
        shapeType: 'round-rect',
        strokeColor: '#cbd5e1',
        strokeWidth: 2,
        type: 'shape',
        width: cardW,
        x: pageX,
        y: pageY,
      };
      newElements.push(sheetEl);

      const pageTitleText = pages.length > 1 ? `${docTitle} (Pág. ${pIdx + 1})` : docTitle;
      const headerEl: BoardTextElement = {
        color: '#0f172a',
        fontSize: 18,
        height: 32,
        id: `text_${Date.now()}_h_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
        text: pageTitleText,
        type: 'text',
        width: cardW - 48,
        x: pageX + 24,
        y: pageY + 24,
      };
      newElements.push(headerEl);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.contentHtml || '';

      let curY = pageY + 70;
      const children = Array.from(tempDiv.children);

      if (children.length === 0) {
        const text = (tempDiv.textContent || '').trim();
        if (text) {
          const pEl: BoardTextElement = {
            color: '#334155',
            fontSize: 13,
            height: 80,
            id: `text_${Date.now()}_p_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.slice(0, 300),
            type: 'text',
            width: cardW - 48,
            x: pageX + 24,
            y: curY,
          };
          newElements.push(pEl);
        }
      } else {
        for (const node of children) {
          if (curY >= pageY + cardH - 60) break;
          const tagName = node.tagName.toLowerCase();
          const textContent = (node.textContent || '').trim();
          if (!textContent && tagName !== 'img' && tagName !== 'hr') continue;

          if (tagName === 'blockquote') {
            const stickyEl: BoardStickyElement = {
              color: DEFAULT_STICKY_COLOR,
              fontSize: 13,
              height: 90,
              id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 200),
              textColor: DEFAULT_STICKY_TEXT_COLOR,
              type: 'sticky',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(stickyEl);
            curY += 102;
          } else if (tagName.startsWith('h')) {
            const hEl: BoardTextElement = {
              color: '#0f172a',
              fontSize: tagName === 'h1' ? 16 : 14,
              height: 26,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 100),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(hEl);
            curY += 34;
          } else if (tagName === 'ul' || tagName === 'ol') {
            const listItems = Array.from(node.querySelectorAll('li')).map((li) => `• ${(li.textContent || '').trim()}`).filter(Boolean);
            const listText = listItems.slice(0, 4).join('\n');
            if (listText) {
              const listEl: BoardTextElement = {
                color: '#334155',
                fontSize: 13,
                height: Math.min(100, listItems.length * 20 + 10),
                id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text: listText,
                type: 'text',
                width: cardW - 48,
                x: pageX + 24,
                y: curY,
              };
              newElements.push(listEl);
              curY += listEl.height + 12;
            }
          } else {
            const pEl: BoardTextElement = {
              color: '#334155',
              fontSize: 13,
              height: 48,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 160),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(pEl);
            curY += 56;
          }
        }
      }
    });

    this.controller.elements.push(...newElements);
    this.controller.pixelGrid.syncPixelGridCanvases(this.controller.elements, () => this.controller.requestRedraw());
    newElements.forEach((el) => this.controller.collaborationManager.broadcastAddElement(el));
    this.controller.selectedElementIds = newElements.map((el) => el.id);
    this.controller.selectedElementId = this.controller.selectedElementIds[0] || null;
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertDiagramAsBoardElements(diagram: { nodes?: Record<string, any>; connections?: any[] } | any, _diagramTitle: string): void {
    if (!diagram || !diagram.nodes) return;
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const nodes = Object.values(diagram.nodes) as any[];
    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      const nw = n.width || 140;
      const nh = n.height || 50;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;
    const offsetX = Math.round(centerWorld.x - centerSourceX);
    const offsetY = Math.round(centerWorld.y - centerSourceY);

    const newElements: BoardElement[] = [];
    const idMap = new Map<string, string>();

    nodes.forEach((n) => {
      const nw = n.width || 140;
      const nh = n.height || 50;
      const nx = Math.round((n.x || 0) + offsetX);
      const ny = Math.round((n.y || 0) + offsetY);
      const newId = `diag_shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      idMap.set(n.id, newId);

      const shapeType: ShapeType = n.shape === 'diamond' ? 'diamond' : (n.shape === 'rect' ? 'rect' : (n.shape === 'pill' ? 'pill' : 'round-rect'));
      const shapeEl: BoardShapeElement = {
        fillColor: n.color || '#3b82f6',
        fontSize: n.fontSize || 14,
        height: nh,
        id: newId,
        isMindMapNode: true,
        shapeType,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        text: n.text || '',
        textColor: n.textColor || '#ffffff',
        type: 'shape',
        width: nw,
        x: nx,
        y: ny,
      };
      newElements.push(shapeEl);
    });

    nodes.forEach((n) => {
      if (n.parentId && idMap.has(n.parentId) && idMap.has(n.id)) {
        const connEl: BoardConnectorElement = {
          arrowEnd: true,
          color: '#64748b',
          fromId: idMap.get(n.parentId)!,
          id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          strokeWidth: 2,
          style: 'curved',
          toId: idMap.get(n.id)!,
          type: 'connector',
        };
        newElements.push(connEl);
      }
    });

    this.controller.elements.push(...newElements);
    this.controller.pixelGrid.syncPixelGridCanvases(this.controller.elements, () => this.controller.requestRedraw());
    newElements.forEach((el) => this.controller.collaborationManager.broadcastAddElement(el));
    this.controller.selectedElementIds = newElements.map((el) => el.id);
    this.controller.selectedElementId = this.controller.selectedElementIds[0] || null;
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }
}
