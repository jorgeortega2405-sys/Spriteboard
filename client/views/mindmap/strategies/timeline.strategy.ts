import { MindMapCamera, MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class TimelineStrategy implements DiagramStrategy {
  public id = 'timeline' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : -380;
      const rootY = rootNode.customPos ? rootNode.y : -210;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#0f172a',
        depth: 0,
        fontSize: 15,
        height: rootDim.height,
        icon: rootNode.icon || 'calendar_month',
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
        width: Math.max(170, rootDim.width),
        x: rootX,
        y: rootY,
      });

      const phases = childrenMap.get(rootId) || [];
      const phaseCount = phases.length;
      const phaseSpacing = 240;
      const startX = -((phaseCount - 1) * phaseSpacing) / 2;

      phases.forEach((phaseId, idx) => {
        const phaseNode = nodes[phaseId];
        if (!phaseNode) return;

        const phaseDim = estimateNodeDimensions(phaseNode, false);
        const autoPhaseX = rootX + startX + idx * phaseSpacing;
        const autoPhaseY = rootY + 210;
        const currentPhaseX = phaseNode.customPos ? phaseNode.x : autoPhaseX;
        const currentPhaseY = phaseNode.customPos ? phaseNode.y : autoPhaseY;
        const items = phaseNode.isCollapsed ? [] : (childrenMap.get(phaseId) || []);

        const phaseColor = phaseNode.color || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 5];

        layoutMap.set(phaseId, {
          childrenIds: items,
          color: phaseColor,
          depth: 1,
          fontSize: 14,
          height: phaseDim.height,
          icon: phaseNode.icon || 'flag',
          id: phaseId,
          isCollapsed: !!phaseNode.isCollapsed,
          isDone: phaseNode.isDone,
          isTask: phaseNode.isTask,
          linkingPhrase: phaseNode.linkingPhrase,
          orderIndex: phaseNode.orderIndex ?? idx,
          parentId: rootId,
          shape: phaseNode.shape || 'pill',
          side: 'bottom',
          text: phaseNode.text,
          textColor: '#ffffff',
          width: Math.max(150, phaseDim.width),
          x: currentPhaseX,
          y: currentPhaseY,
        });

        if (items.length > 0) {
          const isAlternateTop = idx % 2 === 0;
          let topOffset = isAlternateTop ? -80 : 80;
          const stepOffset = isAlternateTop ? -56 : 56;

          items.forEach((itemId, itemIdx) => {
            const itemNode = nodes[itemId];
            if (!itemNode) return;

            const itemDim = estimateNodeDimensions(itemNode, false);
            const autoItemX = currentPhaseX;
            const autoItemY = currentPhaseY + topOffset;
            const currentItemX = itemNode.customPos ? itemNode.x : autoItemX;
            const currentItemY = itemNode.customPos ? itemNode.y : autoItemY;
            const subDeliverables = itemNode.isCollapsed ? [] : (childrenMap.get(itemId) || []);

            layoutMap.set(itemId, {
              childrenIds: subDeliverables,
              color: itemNode.color || phaseColor,
              depth: 2,
              fontSize: 12,
              height: itemDim.height,
              icon: itemNode.icon,
              id: itemId,
              isCollapsed: !!itemNode.isCollapsed,
              isDone: itemNode.isDone,
              isTask: itemNode.isTask !== undefined ? itemNode.isTask : true,
              linkingPhrase: itemNode.linkingPhrase,
              orderIndex: itemNode.orderIndex ?? itemIdx,
              parentId: phaseId,
              shape: itemNode.shape || 'rounded',
              side: isAlternateTop ? 'bottom' : 'center',
              text: itemNode.text,
              textColor: itemNode.textColor || '#ffffff',
              width: Math.max(140, itemDim.width),
              x: currentItemX,
              y: currentItemY,
            });

            topOffset += stepOffset;
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
    rootId: string
  ): void {
    const root = layoutMap.get(rootId);
    if (!root || !root.childrenIds || root.childrenIds.length === 0) return;

    ctx.save();
    const phases = root.childrenIds.map((id) => layoutMap.get(id)).filter(Boolean) as ComputedNodeLayout[];
    const timelineY = phases.length > 0 ? phases.reduce((acc, p) => acc + p.y, 0) / phases.length : root.y + 210;

    let minX = root.x - 200;
    let maxX = root.x + 200;
    if (phases.length > 0) {
      minX = Math.min(...phases.map((p) => p.x - p.width / 2)) - 80;
      maxX = Math.max(...phases.map((p) => p.x + p.width / 2)) + 80;
    }

    const screenTimelineY = (timelineY - camera.y) * camera.zoom + canvasH / 2;
    const screenStart = (minX - camera.x) * camera.zoom + canvasW / 2;
    const screenEnd = (maxX - camera.x) * camera.zoom + canvasW / 2;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(3.5, 5 * camera.zoom);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(screenStart, screenTimelineY);
    ctx.lineTo(screenEnd, screenTimelineY);
    ctx.stroke();

    root.childrenIds.forEach((phaseId) => {
      const phase = layoutMap.get(phaseId);
      if (!phase) return;

      const phaseScreenX = (phase.x - camera.x) * camera.zoom + canvasW / 2;
      const phaseScreenY = (phase.y - camera.y) * camera.zoom + canvasH / 2;

      phase.childrenIds.forEach((itemId) => {
        const item = layoutMap.get(itemId);
        if (!item) return;

        const itemScreenX = (item.x - camera.x) * camera.zoom + canvasW / 2;
        const itemScreenY = (item.y - camera.y) * camera.zoom + canvasH / 2;

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
        ctx.setLineDash([4 * camera.zoom, 4 * camera.zoom]);

        ctx.beginPath();
        ctx.moveTo(phaseScreenX, phaseScreenY);
        ctx.lineTo(itemScreenX, itemScreenY);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    });

    ctx.restore();
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#3b82f6',
      isTask: true,
      shape: 'rounded',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-phase', icon: 'flag', label: 'Nuevo Hito / Fase', tooltip: 'Agregar nueva fase cronológica a la línea' },
      { actionId: 'add-deliverable', icon: 'add_task', label: 'Entregable / Tarea', shortcut: 'Tab', tooltip: 'Agregar tarea o entregable al hito (Tab)' },
      { actionId: 'toggle-task', icon: 'check_box', label: 'Completar Tarea', tooltip: 'Marcar o desmarcar tarea como realizada' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Alinear cronograma temporal' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const q1Id = generateId('node');
    const q2Id = generateId('node');
    const q3Id = generateId('node');
    const q4Id = generateId('node');

    const t1Id = generateId('node');
    const t2Id = generateId('node');
    const t3Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 0.9 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#0f172a',
          fontSize: 15,
          icon: 'timeline',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rounded',
          text: rootText || 'Roadmap de Producto 2026',
          textColor: '#ffffff',
          x: -380,
          y: -210,
        },
        [q1Id]: {
          color: '#3b82f6',
          fontSize: 13,
          icon: 'flag',
          id: q1Id,
          orderIndex: 0,
          parentId: rootId,
          shape: 'pill',
          text: 'Fase 1: Descubrimiento',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [t1Id]: {
          color: '#3b82f6',
          fontSize: 12,
          icon: 'check_circle',
          id: t1Id,
          isDone: true,
          isTask: true,
          orderIndex: 0,
          parentId: q1Id,
          shape: 'rounded',
          text: 'Entrevistas con usuarios iniciales',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [q2Id]: {
          color: '#10b981',
          fontSize: 13,
          icon: 'flag',
          id: q2Id,
          orderIndex: 1,
          parentId: rootId,
          shape: 'pill',
          text: 'Fase 2: Prototipado MVP',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [t2Id]: {
          color: '#10b981',
          fontSize: 12,
          icon: 'task_alt',
          id: t2Id,
          isDone: false,
          isTask: true,
          orderIndex: 0,
          parentId: q2Id,
          shape: 'rounded',
          text: 'Diseño UX en Figma y flujo de auth',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [q3Id]: {
          color: '#f59e0b',
          fontSize: 13,
          icon: 'flag',
          id: q3Id,
          orderIndex: 2,
          parentId: rootId,
          shape: 'pill',
          text: 'Fase 3: Beta Cerrada',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [t3Id]: {
          color: '#f59e0b',
          fontSize: 12,
          icon: 'pending',
          id: t3Id,
          isDone: false,
          isTask: true,
          orderIndex: 0,
          parentId: q3Id,
          shape: 'rounded',
          text: 'Lanzamiento a primeros 100 probadores',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [q4Id]: {
          color: '#8b5cf6',
          fontSize: 13,
          icon: 'rocket_launch',
          id: q4Id,
          orderIndex: 3,
          parentId: rootId,
          shape: 'pill',
          text: 'Fase 4: Lanzamiento Oficial',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'timeline',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'top-down',
        lineStyle: 'orthogonal',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}
