import { MindMapCamera, MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class MatrixStrategy implements DiagramStrategy {
  public id = 'matrix' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : -250;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#0f172a',
        depth: 0,
        fontSize: 16,
        height: rootDim.height,
        icon: rootNode.icon || 'dashboard_customize',
        id: rootId,
        isCollapsed: !!rootNode.isCollapsed,
        isDone: rootNode.isDone,
        isTask: rootNode.isTask,
        linkingPhrase: rootNode.linkingPhrase,
        orderIndex: 0,
        parentId: null,
        shape: rootNode.shape || 'rounded',
        side: 'bottom',
        text: rootNode.text,
        textColor: '#ffffff',
        width: Math.max(180, rootDim.width),
        x: rootX,
        y: rootY,
      });

      const quadrants = childrenMap.get(rootId) || [];
      const quadConfigs = [
        { defaultColor: '#10b981', name: 'Fortalezas' },
        { defaultColor: '#3b82f6', name: 'Oportunidades' },
        { defaultColor: '#f59e0b', name: 'Debilidades' },
        { defaultColor: '#ef4444', name: 'Amenazas' },
      ];

      const measureSubtree = (nodeId: string, depth = 0): { height: number; maxWidth: number } => {
        const node = nodes[nodeId];
        if (!node) return { height: 0, maxWidth: 0 };
        const dim = estimateNodeDimensions(node, false);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        let totalH = Math.max(38, dim.height);
        let maxW = dim.width + depth * 14;
        children.forEach((childId) => {
          const sub = measureSubtree(childId, depth + 1);
          totalH += sub.height + 12;
          if (sub.maxWidth > maxW) maxW = sub.maxWidth;
        });
        return { height: totalH, maxWidth: maxW };
      };

      const getQuadrantDimensions = (qId: string): { height: number; width: number } => {
        const qNode = nodes[qId];
        if (!qNode) return { height: 240, width: 300 };
        const qDim = estimateNodeDimensions(qNode, false);
        const directNotes = qNode.isCollapsed ? [] : (childrenMap.get(qId) || []);
        let notesTotalH = 0;
        let notesMaxW = qDim.width;
        directNotes.forEach((nId) => {
          const m = measureSubtree(nId, 0);
          notesTotalH += m.height + 12;
          if (m.maxWidth > notesMaxW) notesMaxW = m.maxWidth;
        });
        const totalH = Math.max(240, 14 + qDim.height + 16 + notesTotalH + 24);
        const totalW = Math.max(300, notesMaxW + 48, qDim.width + 36);
        return { height: totalH, width: totalW };
      };

      const leftQuads = quadrants.filter((_, idx) => idx % 2 === 0);
      const rightQuads = quadrants.filter((_, idx) => idx % 2 !== 0);

      const maxLeftW = leftQuads.length > 0 ? Math.max(...leftQuads.map((id) => getQuadrantDimensions(id).width)) : 300;
      const maxRightW = rightQuads.length > 0 ? Math.max(...rightQuads.map((id) => getQuadrantDimensions(id).width)) : 300;
      const colW = Math.max(maxLeftW, maxRightW, 300);

      const numRows = Math.ceil(quadrants.length / 2);
      const rowHeights: number[] = [];
      for (let r = 0; r < numRows; r++) {
        const qLeftId = quadrants[r * 2];
        const qRightId = quadrants[r * 2 + 1];
        const hLeft = qLeftId ? getQuadrantDimensions(qLeftId).height : 240;
        const hRight = qRightId ? getQuadrantDimensions(qRightId).height : 240;
        rowHeights.push(Math.max(hLeft, hRight, 240));
      }

      const gapX = 36;
      const gapY = 36;
      const matrixTopY = rootY + rootDim.height / 2 + 60;
      const rowYTop: number[] = [];
      let currentTopY = matrixTopY;
      for (let r = 0; r < numRows; r++) {
        rowYTop.push(currentTopY);
        currentTopY += rowHeights[r] + gapY;
      }

      quadrants.forEach((qId, idx) => {
        const qNode = nodes[qId];
        if (!qNode) return;

        const isLeft = idx % 2 === 0;
        const rowIdx = Math.floor(idx / 2);
        const autoQX = isLeft ? rootX - (colW / 2 + gapX / 2) : rootX + (colW / 2 + gapX / 2);
        const qDim = estimateNodeDimensions(qNode, false);
        const autoQY = (rowYTop[rowIdx] || matrixTopY) + qDim.height / 2 + 14;

        const currentQX = qNode.customPos ? qNode.x : autoQX;
        const currentQY = qNode.customPos ? qNode.y : autoQY;
        const directNotes = qNode.isCollapsed ? [] : (childrenMap.get(qId) || []);
        const defaultCfg = quadConfigs[idx] || { defaultColor: '#6366f1', name: `Cuadrante ${idx + 1}` };

        layoutMap.set(qId, {
          childrenIds: directNotes,
          color: qNode.color || defaultCfg.defaultColor,
          depth: 1,
          fontSize: 14,
          height: qDim.height,
          icon: qNode.icon,
          id: qId,
          isCollapsed: !!qNode.isCollapsed,
          isDone: qNode.isDone,
          isTask: qNode.isTask,
          linkingPhrase: qNode.linkingPhrase,
          orderIndex: qNode.orderIndex ?? idx,
          parentId: rootId,
          shape: qNode.shape || 'rounded',
          side: 'bottom',
          text: qNode.text,
          textColor: '#ffffff',
          width: colW - 24,
          x: currentQX,
          y: currentQY,
        });

        if (directNotes.length > 0) {
          let currentNoteTop = currentQY + qDim.height / 2 + 16;

          const layoutNoteSubtree = (nId: string, depth: number, indent: number): void => {
            const noteNode = nodes[nId];
            if (!noteNode) return;

            const nDim = estimateNodeDimensions(noteNode, false);
            const noteW = Math.max(160, colW - 28 - indent * 14);
            const noteH = Math.max(38, nDim.height);
            const autoNoteX = currentQX + (indent > 0 ? indent * 8 : 0);
            const autoNoteY = currentNoteTop + noteH / 2;
            const currentNoteX = noteNode.customPos ? noteNode.x : autoNoteX;
            const currentNoteY = noteNode.customPos ? noteNode.y : autoNoteY;
            const subItems = noteNode.isCollapsed ? [] : (childrenMap.get(nId) || []);

            layoutMap.set(nId, {
              childrenIds: subItems,
              color: noteNode.color || defaultCfg.defaultColor,
              depth,
              fontSize: Math.max(11, 13 - indent),
              height: noteH,
              icon: noteNode.icon,
              id: nId,
              isCollapsed: !!noteNode.isCollapsed,
              isDone: noteNode.isDone,
              isTask: noteNode.isTask,
              linkingPhrase: noteNode.linkingPhrase,
              orderIndex: noteNode.orderIndex ?? 0,
              parentId: noteNode.parentId,
              shape: noteNode.shape || 'sticky',
              side: 'bottom',
              text: noteNode.text,
              textColor: noteNode.textColor || '#1e293b',
              width: noteW,
              x: currentNoteX,
              y: currentNoteY,
            });

            currentNoteTop += noteH + 12;

            if (subItems.length > 0) {
              subItems.forEach((subId) => {
                layoutNoteSubtree(subId, depth + 1, indent + 1);
              });
            }
          };

          directNotes.forEach((nId, nIdx) => {
            const nNode = nodes[nId];
            if (nNode && nNode.orderIndex === undefined) {
              nNode.orderIndex = nIdx;
            }
            layoutNoteSubtree(nId, 2, 0);
          });
        }
      });
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public drawCustomBackground(
    ctx: CanvasRenderingContext2D,
    layoutMap: Map<string, ComputedNodeLayout>,
    camera: MindMapCamera,
    canvasW: number,
    canvasH: number,
    rootId?: string
  ): void {
    if (!rootId) return;
    const root = layoutMap.get(rootId);
    if (!root || !root.childrenIds || root.childrenIds.length === 0) return;

    ctx.save();

    const quadrants = root.childrenIds;
    const numRows = Math.ceil(quadrants.length / 2);
    const rowHeights: number[] = [];

    const getQuadrantFullHeight = (qId: string): number => {
      const q = layoutMap.get(qId);
      if (!q) return 240;
      let maxY = q.y + q.height / 2;
      const collectDescendants = (nodeId: string) => {
        const node = layoutMap.get(nodeId);
        if (!node) return;
        node.childrenIds.forEach((childId) => {
          const child = layoutMap.get(childId);
          if (child) {
            const childBottom = child.y + child.height / 2;
            if (childBottom > maxY) maxY = childBottom;
            collectDescendants(childId);
          }
        });
      };
      collectDescendants(qId);
      const topY = q.y - q.height / 2 - 14;
      return Math.max(240, maxY - topY + 24);
    };

    for (let r = 0; r < numRows; r++) {
      const qLeftId = quadrants[r * 2];
      const qRightId = quadrants[r * 2 + 1];
      const hLeft = qLeftId ? getQuadrantFullHeight(qLeftId) : 240;
      const hRight = qRightId ? getQuadrantFullHeight(qRightId) : 240;
      rowHeights.push(Math.max(hLeft, hRight, 240));
    }

    quadrants.forEach((qId, idx) => {
      const q = layoutMap.get(qId);
      if (!q) return;

      const rowIdx = Math.floor(idx / 2);
      const boxW = q.width + 24;
      const boxH = rowHeights[rowIdx] || 240;
      const boxTopY = q.y - q.height / 2 - 14;

      const screenLeft = (q.x - boxW / 2 - camera.x) * camera.zoom + canvasW / 2;
      const screenTop = (boxTopY - camera.y) * camera.zoom + canvasH / 2;
      const screenW = boxW * camera.zoom;
      const screenH = boxH * camera.zoom;

      const color = q.color || '#3b82f6';
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.strokeStyle = hexToRgba(color, 0.38);
      ctx.lineWidth = Math.max(1.2, 1.6 * camera.zoom);

      ctx.beginPath();
      ctx.roundRect(screenLeft, screenTop, screenW, screenH, 14 * camera.zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(screenLeft + 4 * camera.zoom, screenTop + 2 * camera.zoom, screenW - 8 * camera.zoom, 5 * camera.zoom, 2 * camera.zoom);
      ctx.fill();
    });

    ctx.restore();
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#3b82f6',
      shape: 'sticky',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-quadrant', icon: 'grid_view', label: 'Nuevo Cuadrante', tooltip: 'Agregar cuadrante de análisis' },
      { actionId: 'add-note', icon: 'sticky_note_2', label: 'Nota Adhesiva', shortcut: 'Tab', tooltip: 'Agregar nota al cuadrante activo (Tab)' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Reajustar matriz 2x2' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const q1Id = generateId('node');
    const q2Id = generateId('node');
    const q3Id = generateId('node');
    const q4Id = generateId('node');

    const f1Id = generateId('node');
    const o1Id = generateId('node');
    const d1Id = generateId('node');
    const a1Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 0.95 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#0f172a',
          fontSize: 16,
          icon: 'dashboard_customize',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rounded',
          text: rootText || 'Análisis FODA Estratégico',
          textColor: '#ffffff',
          x: 0,
          y: -250,
        },
        [q1Id]: {
          color: '#10b981',
          fontSize: 14,
          icon: 'thumb_up',
          id: q1Id,
          orderIndex: 0,
          parentId: rootId,
          shape: 'rounded',
          text: '💪 Fortalezas (Internas)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [f1Id]: {
          color: '#d1fae5',
          fontSize: 12,
          icon: 'star',
          id: f1Id,
          orderIndex: 0,
          parentId: q1Id,
          shape: 'sticky',
          text: 'Equipo con alta experiencia técnica',
          textColor: '#065f46',
          x: 0,
          y: 0,
        },
        [q2Id]: {
          color: '#3b82f6',
          fontSize: 14,
          icon: 'lightbulb',
          id: q2Id,
          orderIndex: 1,
          parentId: rootId,
          shape: 'rounded',
          text: '🚀 Oportunidades (Externas)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [o1Id]: {
          color: '#dbeafe',
          fontSize: 12,
          icon: 'trending_up',
          id: o1Id,
          orderIndex: 0,
          parentId: q2Id,
          shape: 'sticky',
          text: 'Creciente demanda en herramientas visuales',
          textColor: '#1e40af',
          x: 0,
          y: 0,
        },
        [q3Id]: {
          color: '#f59e0b',
          fontSize: 14,
          icon: 'warning',
          id: q3Id,
          orderIndex: 2,
          parentId: rootId,
          shape: 'rounded',
          text: '⚠️ Debilidades (Internas)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [d1Id]: {
          color: '#fef3c7',
          fontSize: 12,
          icon: 'pending',
          id: d1Id,
          orderIndex: 0,
          parentId: q3Id,
          shape: 'sticky',
          text: 'Presupuesto limitado para publicidad masiva',
          textColor: '#92400e',
          x: 0,
          y: 0,
        },
        [q4Id]: {
          color: '#ef4444',
          fontSize: 14,
          icon: 'dangerous',
          id: q4Id,
          orderIndex: 3,
          parentId: rootId,
          shape: 'rounded',
          text: '🛡️ Amenazas (Externas)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [a1Id]: {
          color: '#fee2e2',
          fontSize: 12,
          icon: 'shield',
          id: a1Id,
          orderIndex: 0,
          parentId: q4Id,
          shape: 'sticky',
          text: 'Competidores establecidos con gran capital',
          textColor: '#991b1b',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'matrix',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'top-down',
        lineStyle: 'orthogonal',
        nodeShape: 'sticky',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(99, 102, 241, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
