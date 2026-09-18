import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class DecisionTreeStrategy implements DiagramStrategy {
  public id = 'decisiontree' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : -380;
      const rootY = rootNode.customPos ? rootNode.y : 0;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#6366f1',
        depth: 0,
        fontSize: 15,
        height: rootDim.height,
        icon: rootNode.icon || 'call_split',
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

      const layoutSubtreeLR = (
        nodeId: string,
        depth: number,
        parentX: number,
        parentWidth: number,
        startY: number
      ): number => {
        const node = nodes[nodeId];
        if (!node) return 0;

        const dim = estimateNodeDimensions(node, false);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        const hGap = 70;
        const vGap = 24;

        let subTreeHeight = 0;
        const childHeights: number[] = [];

        if (children.length > 0) {
          children.forEach((childId) => {
            const chNode = nodes[childId];
            if (chNode) {
              const chDim = estimateNodeDimensions(chNode, false);
              const chSub = layoutSubtreeLR(childId, depth + 1, 0, 0, 0);
              const requiredH = Math.max(chDim.height, chSub);
              childHeights.push(requiredH);
              subTreeHeight += requiredH;
            }
          });
          subTreeHeight += (children.length - 1) * vGap;
        } else {
          subTreeHeight = dim.height;
        }

        const autoX = parentX + parentWidth / 2 + hGap + dim.width / 2;
        const autoY = startY;
        const currentX = node.customPos ? node.x : autoX;
        const currentY = node.customPos ? node.y : autoY;

        layoutMap.set(nodeId, {
          childrenIds: children,
          color: node.color || (node.shape === 'diamond' ? '#f59e0b' : (children.length === 0 ? '#10b981' : '#3b82f6')),
          depth,
          fontSize: Math.max(12, 14 - depth),
          height: dim.height,
          icon: node.icon || (children.length === 0 ? 'paid' : 'alt_route'),
          id: nodeId,
          isCollapsed: !!node.isCollapsed,
          isDone: node.isDone,
          isTask: node.isTask,
          linkingPhrase: node.linkingPhrase || 'opción',
          orderIndex: node.orderIndex ?? 0,
          parentId: node.parentId,
          shape: node.shape || (children.length === 0 ? 'rounded' : 'diamond'),
          side: 'right',
          text: node.text,
          textColor: node.textColor || '#ffffff',
          width: Math.max(140, dim.width),
          x: currentX,
          y: currentY,
        });

        if (children.length > 0) {
          let runningChildY = currentY - subTreeHeight / 2;
          children.forEach((childId, i) => {
            const chH = childHeights[i];
            const chCenterY = runningChildY + chH / 2;
            layoutSubtreeLR(childId, depth + 1, currentX, dim.width, chCenterY);
            runningChildY += chH + vGap;
          });
        }

        return subTreeHeight;
      };

      const mainBranches = childrenMap.get(rootId) || [];
      let totalTreeH = 0;
      const branchHeights: number[] = [];

      mainBranches.forEach((bId) => {
        const bNode = nodes[bId];
        if (bNode) {
          const bDim = estimateNodeDimensions(bNode, false);
          const subH = layoutSubtreeLR(bId, 1, 0, 0, 0);
          const requiredH = Math.max(bDim.height, subH);
          branchHeights.push(requiredH);
          totalTreeH += requiredH;
        }
      });
      totalTreeH += Math.max(0, mainBranches.length - 1) * 28;

      let currentBranchY = rootY - totalTreeH / 2;
      mainBranches.forEach((bId, idx) => {
        const bH = branchHeights[idx];
        const centerY = currentBranchY + bH / 2;
        layoutSubtreeLR(bId, 1, rootX, rootDim.width, centerY);
        currentBranchY += bH + 28;
      });
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#3b82f6',
      shape: 'diamond',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-branch', icon: 'call_split', label: 'Nueva Rama / Opción', shortcut: 'Tab', tooltip: 'Agregar rama de opción o escenario (Tab)' },
      { actionId: 'add-outcome', icon: 'check_circle', label: 'Resultado Final', shortcut: 'Enter', tooltip: 'Agregar nodo de resultado o ganancia (Enter)' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Alinear árbol de izquierda a derecha' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const optAId = generateId('node');
    const optBId = generateId('node');

    const highDemandAId = generateId('node');
    const lowDemandAId = generateId('node');
    const outBId = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 0.95 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#6366f1',
          fontSize: 15,
          icon: 'call_split',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rect',
          text: rootText || 'Decisión de Inversión',
          textColor: '#ffffff',
          x: -380,
          y: 0,
        },
        [optAId]: {
          color: '#3b82f6',
          fontSize: 13,
          icon: 'rocket_launch',
          id: optAId,
          linkingPhrase: 'Desarrollar Producto Propio',
          orderIndex: 0,
          parentId: rootId,
          shape: 'diamond',
          text: 'Escenario de Mercado',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [highDemandAId]: {
          color: '#10b981',
          fontSize: 12,
          icon: 'paid',
          id: highDemandAId,
          linkingPhrase: 'Demanda Alta (60%)',
          orderIndex: 0,
          parentId: optAId,
          shape: 'rounded',
          text: 'Ganancia estimada: +$120,000 USD',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [lowDemandAId]: {
          color: '#ef4444',
          fontSize: 12,
          icon: 'trending_down',
          id: lowDemandAId,
          linkingPhrase: 'Demanda Baja (40%)',
          orderIndex: 1,
          parentId: optAId,
          shape: 'rounded',
          text: 'Pérdida moderada: -$25,000 USD',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [optBId]: {
          color: '#0891b2',
          fontSize: 13,
          icon: 'handshake',
          id: optBId,
          linkingPhrase: 'Licenciar a Terceros',
          orderIndex: 1,
          parentId: rootId,
          shape: 'diamond',
          text: 'Retorno Fijo',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [outBId]: {
          color: '#10b981',
          fontSize: 12,
          icon: 'paid',
          id: outBId,
          linkingPhrase: 'Regalías fijas (100%)',
          orderIndex: 0,
          parentId: optBId,
          shape: 'rounded',
          text: 'Ingreso garantizado: +$45,000 USD',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'decisiontree',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#3b82f6', '#0891b2', '#10b981', '#ef4444'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'radial',
        lineStyle: 'orthogonal',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}
