import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class OrgChartStrategy implements DiagramStrategy {
  public id = 'orgchart' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : -160;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#1e1b4b',
        depth: 0,
        fontSize: 15,
        height: rootDim.height,
        icon: rootNode.icon || 'corporate_fare',
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

      const hGap = 40;
      const vGap = 72;

      const computeSubtreeWidth = (nodeId: string): number => {
        const node = nodes[nodeId];
        if (!node) return 0;
        const dim = estimateNodeDimensions(node, nodeId === rootId);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        if (children.length === 0) {
          return Math.max(160, dim.width);
        }

        let childrenTotalW = 0;
        children.forEach((childId, i) => {
          childrenTotalW += computeSubtreeWidth(childId);
          if (i > 0) childrenTotalW += hGap;
        });
        return Math.max(Math.max(160, dim.width), childrenTotalW);
      };

      const layoutOrgNode = (nodeId: string, depth: number, autoTargetX: number, autoTargetY: number): void => {
        const node = nodes[nodeId];
        if (!node) return;

        const dim = estimateNodeDimensions(node, nodeId === rootId);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        const currentX = node.customPos ? node.x : autoTargetX;
        const currentY = node.customPos ? node.y : autoTargetY;

        if (nodeId !== rootId) {
          layoutMap.set(nodeId, {
            childrenIds: children,
            color: node.color || (depth === 1 ? '#4338ca' : (depth === 2 ? '#6366f1' : '#818cf8')),
            depth,
            fontSize: Math.max(12, 14 - depth),
            height: dim.height,
            icon: node.icon || (depth === 1 ? 'badge' : 'person'),
            id: nodeId,
            isCollapsed: !!node.isCollapsed,
            isDone: node.isDone,
            isTask: node.isTask,
            linkingPhrase: node.linkingPhrase,
            orderIndex: node.orderIndex ?? 0,
            parentId: node.parentId,
            shape: node.shape || 'rounded',
            side: 'bottom',
            text: node.text,
            textColor: node.textColor || '#ffffff',
            width: Math.max(160, dim.width),
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
            layoutOrgNode(childId, depth + 1, childCenterX, nextY);
            currentChildLeft += childSubW + hGap;
          });
        }
      };

      layoutOrgNode(rootId, 0, rootX, rootY);
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#4338ca',
      icon: 'person',
      shape: 'rounded',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-subordinate', icon: 'person_add', label: 'Subordinado', shortcut: 'Tab', tooltip: 'Agregar subordinado / reporte directo (Tab)' },
      { actionId: 'add-peer', icon: 'group_add', label: 'Colega / Par', shortcut: 'Enter', tooltip: 'Agregar colega del mismo nivel jerárquico (Enter)' },
      { actionId: 'add-department', icon: 'domain', label: 'Departamento', tooltip: 'Agregar nueva dirección o área corporativa' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Reajustar organigrama jerárquico' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const ctoId = generateId('node');
    const cmoId = generateId('node');
    const cfoId = generateId('node');

    const leadDevId = generateId('node');
    const leadQaId = generateId('node');
    const leadGrowthId = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#1e1b4b',
          fontSize: 15,
          icon: 'corporate_fare',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'rounded',
          text: rootText || 'Dirección General (CEO)',
          textColor: '#ffffff',
          x: 0,
          y: -160,
        },
        [ctoId]: {
          color: '#4338ca',
          fontSize: 14,
          icon: 'computer',
          id: ctoId,
          orderIndex: 0,
          parentId: rootId,
          shape: 'rounded',
          text: 'Dirección de Tecnología (CTO)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [leadDevId]: {
          color: '#6366f1',
          fontSize: 13,
          icon: 'terminal',
          id: leadDevId,
          orderIndex: 0,
          parentId: ctoId,
          shape: 'rounded',
          text: 'Líder de Desarrollo Fullstack',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [leadQaId]: {
          color: '#6366f1',
          fontSize: 13,
          icon: 'bug_report',
          id: leadQaId,
          orderIndex: 1,
          parentId: ctoId,
          shape: 'rounded',
          text: 'Especialista QA & Automatización',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [cmoId]: {
          color: '#ec4899',
          fontSize: 14,
          icon: 'campaign',
          id: cmoId,
          orderIndex: 1,
          parentId: rootId,
          shape: 'rounded',
          text: 'Dirección de Marketing (CMO)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [leadGrowthId]: {
          color: '#f472b6',
          fontSize: 13,
          icon: 'trending_up',
          id: leadGrowthId,
          orderIndex: 0,
          parentId: cmoId,
          shape: 'rounded',
          text: 'Líder de Crecimiento & Ads',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [cfoId]: {
          color: '#059669',
          fontSize: 14,
          icon: 'account_balance',
          id: cfoId,
          orderIndex: 2,
          parentId: rootId,
          shape: 'rounded',
          text: 'Dirección Financiera (CFO)',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      subtype: 'orgchart',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#4338ca', '#ec4899', '#059669'],
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
