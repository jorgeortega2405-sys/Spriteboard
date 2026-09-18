import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class ConceptMapStrategy implements DiagramStrategy {
  public id = 'conceptmap' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : -140;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#0284c7',
        depth: 0,
        fontSize: 16,
        height: rootDim.height,
        icon: rootNode.icon || 'hub',
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
        width: rootDim.width,
        x: rootX,
        y: rootY,
      });

      const hGap = 36;
      const vGap = 84;

      const computeSubtreeWidth = (nodeId: string): number => {
        const node = nodes[nodeId];
        if (!node) return 0;
        const dim = estimateNodeDimensions(node, nodeId === rootId);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        if (children.length === 0) {
          return dim.width;
        }

        let childrenTotalW = 0;
        children.forEach((childId, i) => {
          childrenTotalW += computeSubtreeWidth(childId);
          if (i > 0) childrenTotalW += hGap;
        });
        return Math.max(dim.width, childrenTotalW);
      };

      const layoutTopDownNode = (nodeId: string, depth: number, autoTargetX: number, autoTargetY: number): void => {
        const node = nodes[nodeId];
        if (!node) return;

        const dim = estimateNodeDimensions(node, nodeId === rootId);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        const currentX = node.customPos ? node.x : autoTargetX;
        const currentY = node.customPos ? node.y : autoTargetY;

        if (nodeId !== rootId) {
          layoutMap.set(nodeId, {
            childrenIds: children,
            color: node.color || '#0284c7',
            depth,
            fontSize: Math.max(12, 15 - depth),
            height: dim.height,
            icon: node.icon,
            id: nodeId,
            isCollapsed: !!node.isCollapsed,
            isDone: node.isDone,
            isTask: node.isTask,
            linkingPhrase: node.linkingPhrase || 'se relaciona con',
            orderIndex: node.orderIndex ?? 0,
            parentId: node.parentId,
            shape: node.shape || 'rounded',
            side: 'bottom',
            text: node.text,
            textColor: node.textColor || '#ffffff',
            width: dim.width,
            x: currentX,
            y: currentY,
          });
        }

        if (children.length > 0) {
          const widths = children.map((cId) => computeSubtreeWidth(cId));
          const totalChildrenWidth = widths.reduce((acc, w) => acc + w, 0) + (children.length - 1) * hGap;
          let currentChildLeft = currentX - totalChildrenWidth / 2;
          const nextY = currentY + dim.height / 2 + vGap + 20;

          children.forEach((childId, i) => {
            const childSubW = widths[i];
            const childCenterX = currentChildLeft + childSubW / 2;
            layoutTopDownNode(childId, depth + 1, childCenterX, nextY);
            currentChildLeft += childSubW + hGap;
          });
        }
      };

      layoutTopDownNode(rootId, 0, rootX, rootY);
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#0284c7',
      linkingPhrase: 'se compone de',
      shape: 'rounded',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-child', icon: 'subdirectory_arrow_right', label: 'Sub-concepto', shortcut: 'Tab', tooltip: 'Agregar sub-concepto con frase de enlace (Tab)' },
      { actionId: 'add-sibling', icon: 'add_circle_outline', label: 'Concepto Par', shortcut: 'Enter', tooltip: 'Agregar concepto hermano (Enter)' },
      { actionId: 'add-free-node', icon: 'crop_square', label: 'Concepto Libre', tooltip: 'Agregar concepto libre flotante' },
      { actionId: 'tool-connect', icon: 'arrow_right_alt', label: 'Enlace Proposicional', shortcut: 'C', tooltip: 'Conectar dos conceptos con proposición' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Reorganizar jerarquía vertical' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const c1Id = generateId('node');
    const c2Id = generateId('node');
    const sub1Id = generateId('node');
    const sub2Id = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#0284c7',
          fontSize: 16,
          icon: 'hub',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rounded',
          text: rootText || 'Concepto General',
          textColor: '#ffffff',
          x: 0,
          y: -140,
        },
        [c1Id]: {
          color: '#0ea5e9',
          fontSize: 14,
          icon: 'category',
          id: c1Id,
          linkingPhrase: 'se divide en',
          orderIndex: 0,
          parentId: rootId,
          shape: 'rounded',
          text: 'Primera Dimensión',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [c2Id]: {
          color: '#0ea5e9',
          fontSize: 14,
          icon: 'rule',
          id: c2Id,
          linkingPhrase: 'se fundamenta en',
          orderIndex: 1,
          parentId: rootId,
          shape: 'rounded',
          text: 'Principios Clave',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [sub1Id]: {
          color: '#38bdf8',
          fontSize: 13,
          icon: 'description',
          id: sub1Id,
          linkingPhrase: 'produce',
          orderIndex: 0,
          parentId: c1Id,
          shape: 'rounded',
          text: 'Resultados Prácticos',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [sub2Id]: {
          color: '#38bdf8',
          fontSize: 13,
          icon: 'verified',
          id: sub2Id,
          linkingPhrase: 'garantiza',
          orderIndex: 0,
          parentId: c2Id,
          shape: 'rounded',
          text: 'Calidad y Coherencia',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'conceptmap',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'top-down',
        lineStyle: 'straight',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }
}
