import { MindMapCamera, MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class FishboneStrategy implements DiagramStrategy {
  public id = 'fishbone' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 360;
      const rootY = rootNode.customPos ? rootNode.y : 0;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#ef4444',
        depth: 0,
        fontSize: 16,
        height: rootDim.height,
        icon: rootNode.icon || 'pest_control',
        id: rootId,
        isCollapsed: !!rootNode.isCollapsed,
        isDone: rootNode.isDone,
        isTask: rootNode.isTask,
        linkingPhrase: rootNode.linkingPhrase,
        orderIndex: 0,
        parentId: null,
        shape: rootNode.shape || 'rect',
        side: 'right',
        text: rootNode.text,
        textColor: '#ffffff',
        width: Math.max(160, rootDim.width),
        x: rootX,
        y: rootY,
      });

      const categories = childrenMap.get(rootId) || [];
      const topCategories: string[] = [];
      const bottomCategories: string[] = [];

      categories.forEach((catId, idx) => {
        if (idx % 2 === 0) {
          topCategories.push(catId);
        } else {
          bottomCategories.push(catId);
        }
      });

      const spineStartX = rootX - 880;
      const spineEndX = rootX - rootDim.width / 2 - 20;

      const layoutBones = (catIds: string[], isTop: boolean): void => {
        const count = catIds.length;
        if (count === 0) return;

        const segmentWidth = (spineEndX - spineStartX) / (count + 1);

        catIds.forEach((catId, idx) => {
          const catNode = nodes[catId];
          if (!catNode) return;

          const boneBaseX = spineStartX + (idx + 1) * segmentWidth;
          const catDim = estimateNodeDimensions(catNode, false);
          const autoCatX = boneBaseX - 50;
          const autoCatY = rootY + (isTop ? -180 : 180);
          const currentCatX = catNode.customPos ? catNode.x : autoCatX;
          const currentCatY = catNode.customPos ? catNode.y : autoCatY;
          const subCauses = catNode.isCollapsed ? [] : (childrenMap.get(catId) || []);

          layoutMap.set(catId, {
            childrenIds: subCauses,
            color: catNode.color || (isTop ? '#0284c7' : '#f59e0b'),
            depth: 1,
            fontSize: 14,
            height: catDim.height,
            icon: catNode.icon || 'label',
            id: catId,
            isCollapsed: !!catNode.isCollapsed,
            isDone: catNode.isDone,
            isTask: catNode.isTask,
            linkingPhrase: catNode.linkingPhrase,
            orderIndex: catNode.orderIndex ?? idx,
            parentId: rootId,
            shape: catNode.shape || 'rounded',
            side: isTop ? 'bottom' : 'center',
            text: catNode.text,
            textColor: '#ffffff',
            width: Math.max(140, catDim.width),
            x: currentCatX,
            y: currentCatY,
          });

          if (subCauses.length > 0) {
            const subGapY = isTop ? 44 : -44;
            let currentSubY = currentCatY + (isTop ? 50 : -50);

            subCauses.forEach((subId, sIdx) => {
              const subNode = nodes[subId];
              if (!subNode) return;

              const subDim = estimateNodeDimensions(subNode, false);
              const autoSubX = currentCatX + 40 + sIdx * 20;
              const currentSubX = subNode.customPos ? subNode.x : autoSubX;
              const actualSubY = subNode.customPos ? subNode.y : currentSubY;
              const subSubList = subNode.isCollapsed ? [] : (childrenMap.get(subId) || []);

              layoutMap.set(subId, {
                childrenIds: subSubList,
                color: subNode.color || '#64748b',
                depth: 2,
                fontSize: 12,
                height: subDim.height,
                icon: subNode.icon,
                id: subId,
                isCollapsed: !!subNode.isCollapsed,
                isDone: subNode.isDone,
                isTask: subNode.isTask,
                linkingPhrase: subNode.linkingPhrase,
                orderIndex: subNode.orderIndex ?? sIdx,
                parentId: catId,
                shape: subNode.shape || 'underline',
                side: 'right',
                text: subNode.text,
                textColor: subNode.textColor || '#1e293b',
                width: Math.max(120, subDim.width),
                x: currentSubX,
                y: actualSubY,
              });

              currentSubY += subGapY;
            });
          }
        });
      };

      layoutBones(topCategories, true);
      layoutBones(bottomCategories, false);
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
    if (!root) return;

    ctx.save();
    let minCatX = root.x - 520;
    root.childrenIds.forEach((catId) => {
      const cat = layoutMap.get(catId);
      if (cat && cat.x - 80 < minCatX) {
        minCatX = cat.x - 80;
      }
    });

    const spineStartX = minCatX - 40;
    const spineEndX = root.x - root.width / 2 - 10;
    const spineY = root.y;

    const startScreenX = (spineStartX - camera.x) * camera.zoom + canvasW / 2;
    const endScreenX = (spineEndX - camera.x) * camera.zoom + canvasW / 2;
    const screenY = (spineY - camera.y) * camera.zoom + canvasH / 2;

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(3, 4 * camera.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(startScreenX, screenY);
    ctx.lineTo(endScreenX, screenY);
    ctx.stroke();

    const arrowSize = 14 * camera.zoom;
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(endScreenX, screenY);
    ctx.lineTo(endScreenX - arrowSize * 1.4, screenY - arrowSize * 0.7);
    ctx.lineTo(endScreenX - arrowSize * 1.4, screenY + arrowSize * 0.7);
    ctx.closePath();
    ctx.fill();

    root.childrenIds.forEach((catId) => {
      const cat = layoutMap.get(catId);
      if (!cat) return;

      const catScreenX = (cat.x - camera.x) * camera.zoom + canvasW / 2;
      const catScreenY = (cat.y - camera.y) * camera.zoom + canvasH / 2;
      const targetSpineX = (cat.x + 60 - camera.x) * camera.zoom + canvasW / 2;

      ctx.strokeStyle = cat.color || '#0284c7';
      ctx.lineWidth = Math.max(2, 2.5 * camera.zoom);

      ctx.beginPath();
      ctx.moveTo(catScreenX, catScreenY);
      ctx.lineTo(targetSpineX, screenY);
      ctx.stroke();

      cat.childrenIds.forEach((subId) => {
        const sub = layoutMap.get(subId);
        if (!sub) return;

        const subScreenX = (sub.x - camera.x) * camera.zoom + canvasW / 2;
        const subScreenY = (sub.y - camera.y) * camera.zoom + canvasH / 2;

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
        ctx.beginPath();
        ctx.moveTo(subScreenX - (sub.width / 2) * camera.zoom, subScreenY);
        ctx.lineTo(subScreenX + (sub.width / 2) * camera.zoom, subScreenY);
        ctx.stroke();
      });
    });

    ctx.restore();
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#0284c7',
      shape: 'rounded',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-category', icon: 'account_tree', label: 'Nueva Espina (6M)', tooltip: 'Agregar categoría o espina principal' },
      { actionId: 'add-cause', icon: 'subdirectory_arrow_right', label: 'Causa Raíz', shortcut: 'Tab', tooltip: 'Agregar causa secundaria a la categoría (Tab)' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Reajustar espinas y causas' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const methodId = generateId('node');
    const machineId = generateId('node');
    const peopleId = generateId('node');
    const materialId = generateId('node');

    const m1Id = generateId('node');
    const m2Id = generateId('node');
    const p1Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 0.95 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#ef4444',
          fontSize: 15,
          icon: 'report_problem',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rect',
          text: rootText || 'Problema / Efecto Principal',
          textColor: '#ffffff',
          x: 360,
          y: 0,
        },
        [methodId]: {
          color: '#0284c7',
          fontSize: 13,
          icon: 'settings_suggest',
          id: methodId,
          orderIndex: 0,
          parentId: rootId,
          shape: 'rounded',
          text: '1. Método & Procesos',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [m1Id]: {
          color: '#475569',
          fontSize: 12,
          id: m1Id,
          orderIndex: 0,
          parentId: methodId,
          shape: 'underline',
          text: 'Falta de documentación de pasos',
          textColor: '#1e293b',
          x: 0,
          y: 0,
        },
        [m2Id]: {
          color: '#475569',
          fontSize: 12,
          id: m2Id,
          orderIndex: 1,
          parentId: methodId,
          shape: 'underline',
          text: 'Procedimientos obsoletos',
          textColor: '#1e293b',
          x: 0,
          y: 0,
        },
        [machineId]: {
          color: '#0891b2',
          fontSize: 13,
          icon: 'precision_manufacturing',
          id: machineId,
          orderIndex: 1,
          parentId: rootId,
          shape: 'rounded',
          text: '2. Maquinaria & Equipos',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [peopleId]: {
          color: '#f59e0b',
          fontSize: 13,
          icon: 'groups',
          id: peopleId,
          orderIndex: 2,
          parentId: rootId,
          shape: 'rounded',
          text: '3. Mano de Obra (Personal)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [p1Id]: {
          color: '#475569',
          fontSize: 12,
          id: p1Id,
          orderIndex: 0,
          parentId: peopleId,
          shape: 'underline',
          text: 'Capacitación insuficiente en herramientas',
          textColor: '#1e293b',
          x: 0,
          y: 0,
        },
        [materialId]: {
          color: '#d97706',
          fontSize: 13,
          icon: 'inventory_2',
          id: materialId,
          orderIndex: 3,
          parentId: rootId,
          shape: 'rounded',
          text: '4. Materiales & Insumos',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'fishbone',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#0284c7', '#0891b2', '#f59e0b', '#d97706'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'radial',
        lineStyle: 'straight',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}
