import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class MindMapRadialStrategy implements DiagramStrategy {
  public id = 'mindmap' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : 0;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#6366f1',
        depth: 0,
        fontSize: 16,
        height: rootDim.height,
        icon: rootNode.icon,
        id: rootId,
        isCollapsed: !!rootNode.isCollapsed,
        isDone: rootNode.isDone,
        isTask: rootNode.isTask,
        linkingPhrase: rootNode.linkingPhrase,
        orderIndex: 0,
        parentId: null,
        shape: rootNode.shape || 'pill',
        side: 'center',
        text: rootNode.text,
        textColor: '#ffffff',
        width: rootDim.width,
        x: rootX,
        y: rootY,
      });

      const mainBranches = childrenMap.get(rootId) || [];
      const rightBranches: string[] = [];
      const leftBranches: string[] = [];

      mainBranches.forEach((nodeId, idx) => {
        if (idx % 2 === 0) {
          rightBranches.push(nodeId);
        } else {
          leftBranches.push(nodeId);
        }
      });

      const layoutSubtree = (
        nodeId: string,
        side: 'left' | 'right',
        depth: number,
        parentX: number,
        parentWidth: number,
        startY: number
      ): number => {
        const node = nodes[nodeId];
        if (!node) return 0;

        const dim = estimateNodeDimensions(node, false);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        const hGap = 60;
        const vGap = 20;

        let subTreeHeight = 0;
        const childHeights: number[] = [];

        if (children.length > 0) {
          children.forEach((childId) => {
            const chNode = nodes[childId];
            if (chNode) {
              const chDim = estimateNodeDimensions(chNode, false);
              const chSub = layoutSubtree(childId, side, depth + 1, 0, 0, 0);
              const requiredH = Math.max(chDim.height, chSub);
              childHeights.push(requiredH);
              subTreeHeight += requiredH;
            }
          });
          subTreeHeight += (children.length - 1) * vGap;
        } else {
          subTreeHeight = dim.height;
        }

        const autoX = side === 'right' ? parentX + (parentWidth / 2) + hGap + (dim.width / 2) : parentX - (parentWidth / 2) - hGap - (dim.width / 2);
        const autoY = startY;
        const currentX = node.customPos ? node.x : autoX;
        const currentY = node.customPos ? node.y : autoY;

        layoutMap.set(nodeId, {
          childrenIds: children,
          color: node.color || (side === 'right' ? '#3b82f6' : '#10b981'),
          depth,
          fontSize: Math.max(12, 15 - depth),
          height: dim.height,
          icon: node.icon,
          id: nodeId,
          isCollapsed: !!node.isCollapsed,
          isDone: node.isDone,
          isTask: node.isTask,
          linkingPhrase: node.linkingPhrase,
          orderIndex: node.orderIndex ?? 0,
          parentId: node.parentId,
          shape: node.shape || 'pill',
          side,
          text: node.text,
          textColor: node.textColor || '#ffffff',
          width: dim.width,
          x: currentX,
          y: currentY,
        });

        if (children.length > 0) {
          let runningChildY = currentY - subTreeHeight / 2;
          children.forEach((childId, i) => {
            const chH = childHeights[i];
            const chCenterY = runningChildY + chH / 2;
            layoutSubtree(childId, side, depth + 1, currentX, dim.width, chCenterY);
            runningChildY += chH + vGap;
          });
        }

        return subTreeHeight;
      };

      const calculateGroupHeight = (branchIds: string[], side: 'left' | 'right'): number => {
        let total = 0;
        branchIds.forEach((bId) => {
          const bNode = nodes[bId];
          if (bNode) {
            const bDim = estimateNodeDimensions(bNode, false);
            const subH = layoutSubtree(bId, side, 1, 0, 0, 0);
            total += Math.max(bDim.height, subH);
          }
        });
        total += Math.max(0, branchIds.length - 1) * 24;
        return total;
      };

      const rightTotalH = calculateGroupHeight(rightBranches, 'right');
      let rightRunningY = rootY - rightTotalH / 2;
      rightBranches.forEach((bId) => {
        const bNode = nodes[bId];
        if (bNode) {
          const bDim = estimateNodeDimensions(bNode, false);
          const subH = layoutSubtree(bId, 'right', 1, 0, 0, 0);
          const branchH = Math.max(bDim.height, subH);
          layoutSubtree(bId, 'right', 1, rootX, rootDim.width, rightRunningY + branchH / 2);
          rightRunningY += branchH + 24;
        }
      });

      const leftTotalH = calculateGroupHeight(leftBranches, 'left');
      let leftRunningY = rootY - leftTotalH / 2;
      leftBranches.forEach((bId) => {
        const bNode = nodes[bId];
        if (bNode) {
          const bDim = estimateNodeDimensions(bNode, false);
          const subH = layoutSubtree(bId, 'left', 1, 0, 0, 0);
          const branchH = Math.max(bDim.height, subH);
          layoutSubtree(bId, 'left', 1, rootX, rootDim.width, leftRunningY + branchH / 2);
          leftRunningY += branchH + 24;
        }
      });
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#6366f1',
      shape: 'pill',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-child', icon: 'subdirectory_arrow_right', label: 'Rama Hija', shortcut: 'Tab', tooltip: 'Agregar sub-idea / rama (Tab)' },
      { actionId: 'add-sibling', icon: 'add_circle_outline', label: 'Idea Hermana', shortcut: 'Enter', tooltip: 'Agregar idea hermana (Enter)' },
      { actionId: 'add-free-node', icon: 'crop_square', label: 'Idea Libre', tooltip: 'Agregar cuadro libre flotante' },
      { actionId: 'tool-connect', icon: 'arrow_right_alt', label: 'Conector', shortcut: 'C', tooltip: 'Conector libre entre ideas (C)' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Reajustar y equilibrar ramas automáticamente' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const branch1Id = generateId('node');
    const branch2Id = generateId('node');
    const branch3Id = generateId('node');
    const branch4Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#6366f1',
          fontSize: 16,
          icon: 'psychology',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'pill',
          text: rootText || 'Idea Principal',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [branch1Id]: {
          color: '#3b82f6',
          fontSize: 14,
          icon: 'lightbulb',
          id: branch1Id,
          orderIndex: 0,
          parentId: rootId,
          shape: 'pill',
          text: 'Concepto Clave 1',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [branch2Id]: {
          color: '#10b981',
          fontSize: 14,
          icon: 'target',
          id: branch2Id,
          orderIndex: 1,
          parentId: rootId,
          shape: 'pill',
          text: 'Objetivos y Metas',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [branch3Id]: {
          color: '#f59e0b',
          fontSize: 14,
          icon: 'bolt',
          id: branch3Id,
          orderIndex: 2,
          parentId: rootId,
          shape: 'pill',
          text: 'Estrategias de Acción',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [branch4Id]: {
          color: '#ec4899',
          fontSize: 14,
          icon: 'stars',
          id: branch4Id,
          orderIndex: 3,
          parentId: rootId,
          shape: 'pill',
          text: 'Resultados Esperados',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'mindmap',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'radial',
        lineStyle: 'curved',
        nodeShape: 'pill',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}
