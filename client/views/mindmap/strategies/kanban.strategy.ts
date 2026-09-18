import { MindMapCamera, MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class KanbanStrategy implements DiagramStrategy {
  public id = 'kanban' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : -150;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#1e293b',
        depth: 0,
        fontSize: 15,
        height: rootDim.height,
        icon: rootNode.icon || 'view_kanban',
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

      const columns = childrenMap.get(rootId) || [];
      const colGap = 36;
      const cardGap = 12;

      const measureCardSubtree = (cardId: string, depth = 0): { height: number; maxWidth: number } => {
        const cNode = nodes[cardId];
        if (!cNode) return { height: 0, maxWidth: 0 };
        const dim = estimateNodeDimensions(cNode, false);
        const children = cNode.isCollapsed ? [] : (childrenMap.get(cardId) || []);
        let totalH = Math.max(40, dim.height);
        let maxW = dim.width + depth * 14;
        children.forEach((subId) => {
          const sub = measureCardSubtree(subId, depth + 1);
          totalH += sub.height + cardGap;
          if (sub.maxWidth > maxW) maxW = sub.maxWidth;
        });
        return { height: totalH, maxWidth: maxW };
      };

      const getColumnDimensions = (colId: string): { height: number; width: number } => {
        const colNode = nodes[colId];
        if (!colNode) return { height: 280, width: 280 };
        const colDim = estimateNodeDimensions(colNode, false);
        const directCards = colNode.isCollapsed ? [] : (childrenMap.get(colId) || []);
        let cardsTotalH = 0;
        let cardsMaxW = colDim.width;
        directCards.forEach((cId) => {
          const m = measureCardSubtree(cId, 0);
          cardsTotalH += m.height + cardGap;
          if (m.maxWidth > cardsMaxW) cardsMaxW = m.maxWidth;
        });
        const totalH = Math.max(280, 14 + colDim.height + 16 + cardsTotalH + 24);
        const totalW = Math.max(280, cardsMaxW + 40, colDim.width + 30);
        return { height: totalH, width: totalW };
      };

      const colWidths = columns.map((colId) => getColumnDimensions(colId).width);
      const totalColsW = colWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, columns.length - 1) * colGap;
      let runningLeftX = rootX - totalColsW / 2;
      const colHeaderY = rootY + rootDim.height / 2 + 64;

      columns.forEach((colId, colIdx) => {
        const colNode = nodes[colId];
        if (!colNode) return;

        const colW = colWidths[colIdx];
        const autoColX = runningLeftX + colW / 2;
        runningLeftX += colW + colGap;

        const autoColY = colHeaderY;
        const currentColX = colNode.customPos ? colNode.x : autoColX;
        const currentColY = colNode.customPos ? colNode.y : autoColY;
        const directCards = colNode.isCollapsed ? [] : (childrenMap.get(colId) || []);
        const colDim = estimateNodeDimensions(colNode, false);

        layoutMap.set(colId, {
          childrenIds: directCards,
          color: colNode.color || '#3b82f6',
          depth: 1,
          fontSize: 14,
          height: colDim.height,
          icon: colNode.icon,
          id: colId,
          isCollapsed: !!colNode.isCollapsed,
          isDone: colNode.isDone,
          isTask: colNode.isTask,
          linkingPhrase: colNode.linkingPhrase,
          orderIndex: colNode.orderIndex ?? colIdx,
          parentId: rootId,
          shape: colNode.shape || 'rounded',
          side: 'bottom',
          text: colNode.text,
          textColor: colNode.textColor || '#ffffff',
          width: colW - 20,
          x: currentColX,
          y: currentColY,
        });

        if (directCards.length > 0) {
          let nextCardTop = currentColY + colDim.height / 2 + 16;

          const layoutCardAndChildren = (cardId: string, depth: number, indent: number): void => {
            const cardNode = nodes[cardId];
            if (!cardNode) return;

            const cardDim = estimateNodeDimensions(cardNode, false);
            const cardW = Math.max(160, colW - 32 - indent * 14);
            const cardH = Math.max(40, cardDim.height);
            const autoCardX = currentColX + (indent > 0 ? indent * 8 : 0);
            const autoCardY = nextCardTop + cardH / 2;
            const currentCardX = cardNode.customPos ? cardNode.x : autoCardX;
            const currentCardY = cardNode.customPos ? cardNode.y : autoCardY;
            const subChildren = cardNode.isCollapsed ? [] : (childrenMap.get(cardId) || []);

            layoutMap.set(cardId, {
              childrenIds: subChildren,
              color: cardNode.color || colNode.color || '#3b82f6',
              depth,
              fontSize: Math.max(12, 14 - depth),
              height: cardH,
              icon: cardNode.icon,
              id: cardId,
              isCollapsed: !!cardNode.isCollapsed,
              isDone: cardNode.isDone,
              isTask: cardNode.isTask !== undefined ? cardNode.isTask : true,
              linkingPhrase: cardNode.linkingPhrase,
              orderIndex: cardNode.orderIndex ?? 0,
              parentId: cardNode.parentId,
              shape: cardNode.shape || 'rounded',
              side: 'bottom',
              text: cardNode.text,
              textColor: cardNode.textColor || '#ffffff',
              width: cardW,
              x: currentCardX,
              y: currentCardY,
            });

            nextCardTop += cardH + cardGap;

            if (subChildren.length > 0) {
              subChildren.forEach((subId) => {
                layoutCardAndChildren(subId, depth + 1, indent + 1);
              });
            }
          };

          directCards.forEach((cardId, cardIdx) => {
            const cNode = nodes[cardId];
            if (cNode && cNode.orderIndex === undefined) {
              cNode.orderIndex = cardIdx;
            }
            layoutCardAndChildren(cardId, 2, 0);
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

    const columns = root.childrenIds;
    let maxBoardColH = 280;

    columns.forEach((colId) => {
      const col = layoutMap.get(colId);
      if (!col) return;
      let maxY = col.y + col.height / 2;
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
      collectDescendants(colId);
      const topY = col.y - col.height / 2 - 12;
      const totalColH = maxY - topY + 24;
      if (totalColH > maxBoardColH) maxBoardColH = totalColH;
    });

    columns.forEach((colId) => {
      const col = layoutMap.get(colId);
      if (!col) return;

      const boxW = col.width + 20;
      const boxTopY = col.y - col.height / 2 - 12;
      const boxH = Math.max(maxBoardColH, 280);

      const colScreenX = (col.x - camera.x) * camera.zoom + canvasW / 2;
      const colScreenY = (boxTopY - camera.y) * camera.zoom + canvasH / 2;
      const screenW = boxW * camera.zoom;
      const screenH = boxH * camera.zoom;
      const colLeft = colScreenX - screenW / 2;
      const colTop = colScreenY;

      ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.95)';
      ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);

      ctx.beginPath();
      ctx.roundRect(colLeft, colTop, screenW, screenH, 12 * camera.zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = col.color || '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(colLeft + 4 * camera.zoom, colTop + 2 * camera.zoom, screenW - 8 * camera.zoom, 4 * camera.zoom, 2 * camera.zoom);
      ctx.fill();
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
      { actionId: 'add-column', icon: 'view_column', label: 'Nueva Columna', tooltip: 'Agregar nueva columna de estado' },
      { actionId: 'add-task', icon: 'add_task', label: 'Nueva Tarea', tooltip: 'Agregar tarjeta de tarea a la columna' },
      { actionId: 'toggle-task', icon: 'check_box', label: 'Completar Tarea', tooltip: 'Marcar o desmarcar tarea como realizada' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Alinear Columnas', tooltip: 'Auto-alinear columnas y tarjetas' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const todoId = generateId('node');
    const inProgId = generateId('node');
    const doneId = generateId('node');

    const task1Id = generateId('node');
    const task2Id = generateId('node');
    const task3Id = generateId('node');
    const task4Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#1e293b',
          fontSize: 15,
          icon: 'view_kanban',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rounded',
          text: rootText || 'Tablero del Proyecto',
          textColor: '#ffffff',
          x: 0,
          y: -150,
        },
        [todoId]: {
          color: '#3b82f6',
          fontSize: 14,
          icon: 'assignment',
          id: todoId,
          orderIndex: 0,
          parentId: rootId,
          shape: 'rounded',
          text: '📋 Por Hacer',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [task1Id]: {
          color: '#3b82f6',
          fontSize: 13,
          icon: 'design_services',
          id: task1Id,
          isDone: false,
          isTask: true,
          orderIndex: 0,
          parentId: todoId,
          shape: 'rounded',
          text: 'Diseñar interfaz y prototipo de usuario',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [task2Id]: {
          color: '#3b82f6',
          fontSize: 13,
          icon: 'storage',
          id: task2Id,
          isDone: false,
          isTask: true,
          orderIndex: 1,
          parentId: todoId,
          shape: 'rounded',
          text: 'Definir modelo de datos y esquemas',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [inProgId]: {
          color: '#f59e0b',
          fontSize: 14,
          icon: 'trending_up',
          id: inProgId,
          orderIndex: 1,
          parentId: rootId,
          shape: 'rounded',
          text: '⚡ En Progreso',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [task3Id]: {
          color: '#f59e0b',
          fontSize: 13,
          icon: 'code',
          id: task3Id,
          isDone: false,
          isTask: true,
          orderIndex: 0,
          parentId: inProgId,
          shape: 'rounded',
          text: 'Construir servicios y endpoints REST',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [doneId]: {
          color: '#10b981',
          fontSize: 14,
          icon: 'check_circle',
          id: doneId,
          orderIndex: 2,
          parentId: rootId,
          shape: 'rounded',
          text: '✅ Completado',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [task4Id]: {
          color: '#10b981',
          fontSize: 13,
          icon: 'verified',
          id: task4Id,
          isDone: true,
          isTask: true,
          orderIndex: 0,
          parentId: doneId,
          shape: 'rounded',
          text: 'Configuración inicial del repositorio',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'kanban',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#3b82f6', '#f59e0b', '#10b981'],
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
