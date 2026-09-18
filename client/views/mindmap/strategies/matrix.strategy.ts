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
      const quadPositions = [
        { defaultColor: '#10b981', name: 'Fortalezas', x: -210, y: -130 },
        { defaultColor: '#3b82f6', name: 'Oportunidades', x: 210, y: -130 },
        { defaultColor: '#f59e0b', name: 'Debilidades', x: -210, y: 130 },
        { defaultColor: '#ef4444', name: 'Amenazas', x: 210, y: 130 },
      ];

      quadrants.forEach((qId, idx) => {
        const qNode = nodes[qId];
        if (!qNode) return;

        const defaultPos = quadPositions[idx] || { defaultColor: '#6366f1', name: `Cuadrante ${idx + 1}`, x: (idx % 2 === 0 ? -210 : 210), y: (idx < 2 ? -130 : 130) };
        const qDim = estimateNodeDimensions(qNode, false);
        const autoQX = defaultPos.x;
        const autoQY = defaultPos.y;
        const currentQX = qNode.customPos ? qNode.x : autoQX;
        const currentQY = qNode.customPos ? qNode.y : autoQY;
        const notesList = qNode.isCollapsed ? [] : (childrenMap.get(qId) || []);

        layoutMap.set(qId, {
          childrenIds: notesList,
          color: qNode.color || defaultPos.defaultColor,
          depth: 1,
          fontSize: 14,
          height: qDim.height,
          icon: qNode.icon || 'category',
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
          width: Math.max(180, qDim.width),
          x: currentQX,
          y: currentQY,
        });

        if (notesList.length > 0) {
          let currentNoteY = currentQY + qDim.height / 2 + 18;

          notesList.forEach((nId, nIdx) => {
            const noteNode = nodes[nId];
            if (!noteNode) return;

            const nDim = estimateNodeDimensions(noteNode, false);
            const autoNoteX = currentQX;
            const autoNoteY = currentNoteY + nDim.height / 2;
            const currentNoteX = noteNode.customPos ? noteNode.x : autoNoteX;
            const actualNoteY = noteNode.customPos ? noteNode.y : autoNoteY;
            const subItems = noteNode.isCollapsed ? [] : (childrenMap.get(nId) || []);

            layoutMap.set(nId, {
              childrenIds: subItems,
              color: noteNode.color || defaultPos.defaultColor,
              depth: 2,
              fontSize: 12,
              height: nDim.height,
              icon: noteNode.icon || 'sticky_note_2',
              id: nId,
              isCollapsed: !!noteNode.isCollapsed,
              isDone: noteNode.isDone,
              isTask: noteNode.isTask,
              linkingPhrase: noteNode.linkingPhrase,
              orderIndex: noteNode.orderIndex ?? nIdx,
              parentId: qId,
              shape: noteNode.shape || 'sticky',
              side: 'bottom',
              text: noteNode.text,
              textColor: noteNode.textColor || '#1e293b',
              width: Math.max(170, nDim.width),
              x: currentNoteX,
              y: actualNoteY,
            });

            currentNoteY += nDim.height + 10;
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
    canvasH: number
  ): void {
    ctx.save();
    const boxSize = 340;
    const padding = 12;

    const quadrants = [
      { bg: 'rgba(16, 185, 129, 0.06)', border: '#10b981', x: -boxSize - padding, y: -boxSize / 2 - padding },
      { bg: 'rgba(59, 130, 246, 0.06)', border: '#3b82f6', x: padding, y: -boxSize / 2 - padding },
      { bg: 'rgba(245, 158, 11, 0.06)', border: '#f59e0b', x: -boxSize - padding, y: padding },
      { bg: 'rgba(239, 68, 68, 0.06)', border: '#ef4444', x: padding, y: padding },
    ];

    quadrants.forEach((q) => {
      const screenX = (q.x - camera.x) * camera.zoom + canvasW / 2;
      const screenY = (q.y - camera.y) * camera.zoom + canvasH / 2;
      const w = boxSize * camera.zoom;
      const h = (boxSize / 1.3) * camera.zoom;

      ctx.fillStyle = q.bg;
      ctx.strokeStyle = q.border;
      ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);

      ctx.beginPath();
      ctx.roundRect(screenX, screenY, w, h, 10 * camera.zoom);
      ctx.fill();
      ctx.stroke();
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
