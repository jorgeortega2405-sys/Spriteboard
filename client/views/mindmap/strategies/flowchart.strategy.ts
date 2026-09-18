import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout, DiagramStrategy, QuickToolAction } from './diagram-strategy.interface.js';
import { buildChildrenMap, estimateNodeDimensions, generateId, layoutFreeNodes } from './strategy-helper.js';

export class FlowchartStrategy implements DiagramStrategy {
  public id = 'flowchart' as const;

  public computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
    const layoutMap = new Map<string, ComputedNodeLayout>();
    const nodes = project.nodes;
    const rootId = project.rootId;
    const rootNode = nodes[rootId];
    const { childrenMap, freeRootIds } = buildChildrenMap(project);

    if (rootNode) {
      const rootDim = estimateNodeDimensions(rootNode, true);
      const rootX = rootNode.customPos ? rootNode.x : 0;
      const rootY = rootNode.customPos ? rootNode.y : -180;

      layoutMap.set(rootId, {
        childrenIds: childrenMap.get(rootId) || [],
        color: rootNode.color || '#10b981',
        depth: 0,
        fontSize: 15,
        height: rootDim.height,
        icon: rootNode.icon || 'play_circle',
        id: rootId,
        isCollapsed: !!rootNode.isCollapsed,
        isDone: rootNode.isDone,
        isTask: rootNode.isTask,
        linkingPhrase: rootNode.linkingPhrase,
        orderIndex: 0,
        parentId: null,
        shape: rootNode.shape || 'pill',
        side: 'bottom',
        text: rootNode.text,
        textColor: '#ffffff',
        width: rootDim.width,
        x: rootX,
        y: rootY,
      });

      const hGap = 48;
      const vGap = 64;

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

      const layoutFlowchartNode = (nodeId: string, depth: number, autoTargetX: number, autoTargetY: number): void => {
        const node = nodes[nodeId];
        if (!node) return;

        const dim = estimateNodeDimensions(node, nodeId === rootId);
        const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
        const currentX = node.customPos ? node.x : autoTargetX;
        const currentY = node.customPos ? node.y : autoTargetY;

        if (nodeId !== rootId) {
          layoutMap.set(nodeId, {
            childrenIds: children,
            color: node.color || (node.shape === 'diamond' ? '#f59e0b' : (node.shape === 'pill' ? '#ef4444' : '#6366f1')),
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
            layoutFlowchartNode(childId, depth + 1, childCenterX, nextY);
            currentChildLeft += childSubW + hGap;
          });
        }
      };

      layoutFlowchartNode(rootId, 0, rootX, rootY);
    }

    layoutFreeNodes(project, layoutMap, childrenMap, freeRootIds);
    return layoutMap;
  }

  public getDefaultNodeConfig(): Partial<MindMapNode> {
    return {
      color: '#6366f1',
      shape: 'rounded',
    };
  }

  public getQuickTools(): QuickToolAction[] {
    return [
      { actionId: 'add-process', icon: 'crop_square', label: 'Paso de Proceso', tooltip: 'Insertar paso de proceso rectangular' },
      { actionId: 'add-decision', icon: 'diamond', label: 'Decisión (Sí/No)', tooltip: 'Insertar bifurcación de decisión condicional' },
      { actionId: 'add-io', icon: 'aspect_ratio', label: 'Entrada / Salida', tooltip: 'Insertar datos de entrada o salida (paralelogramo)' },
      { actionId: 'add-end', icon: 'stop_circle', label: 'Fin de Proceso', tooltip: 'Insertar nodo de fin o cierre' },
      { actionId: 'tool-connect', icon: 'alt_route', label: 'Conector', shortcut: 'C', tooltip: 'Trazar conector ortogonal entre pasos' },
      { actionId: 'tidy-up', icon: 'auto_fix_high', label: 'Auto-organizar', tooltip: 'Alinear flujo secuencialmente' },
    ];
  }

  public getInitialProject(rootText: string): MindMapProject {
    const rootId = generateId('root');
    const step1Id = generateId('node');
    const decisionId = generateId('node');
    const yesStepId = generateId('node');
    const noStepId = generateId('node');
    const endId = generateId('node');

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [
        {
          arrow: true,
          color: '#10b981',
          fromId: yesStepId,
          id: generateId('conn'),
          label: 'Concluir',
          style: 'orthogonal',
          toId: endId,
        },
      ],
      nodes: {
        [rootId]: {
          color: '#10b981',
          fontSize: 15,
          icon: 'play_circle',
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'pill',
          text: rootText || 'Inicio del Proceso',
          textColor: '#ffffff',
          x: 0,
          y: -180,
        },
        [step1Id]: {
          color: '#6366f1',
          fontSize: 14,
          icon: 'input',
          id: step1Id,
          orderIndex: 0,
          parentId: rootId,
          shape: 'parallelogram',
          text: 'Ingresar Datos de Entrada',
          textColor: '#ffffff',
          x: 0,
          y: -90,
        },
        [decisionId]: {
          color: '#f59e0b',
          fontSize: 14,
          icon: 'help',
          id: decisionId,
          orderIndex: 0,
          parentId: step1Id,
          shape: 'diamond',
          text: '¿Validación Correcta?',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
        [yesStepId]: {
          color: '#10b981',
          fontSize: 13,
          icon: 'check_circle',
          id: yesStepId,
          linkingPhrase: 'Sí',
          orderIndex: 0,
          parentId: decisionId,
          shape: 'rounded',
          text: 'Procesar y Guardar Registro',
          textColor: '#ffffff',
          x: 160,
          y: 110,
        },
        [noStepId]: {
          color: '#ef4444',
          fontSize: 13,
          icon: 'cancel',
          id: noStepId,
          linkingPhrase: 'No',
          orderIndex: 1,
          parentId: decisionId,
          shape: 'rounded',
          text: 'Mostrar Mensaje de Corrección',
          textColor: '#ffffff',
          x: -160,
          y: 110,
        },
        [endId]: {
          color: '#ef4444',
          fontSize: 14,
          icon: 'stop_circle',
          id: endId,
          orderIndex: 0,
          parentId: null,
          shape: 'pill',
          text: 'Fin del Proceso',
          textColor: '#ffffff',
          x: 160,
          y: 200,
        },
      },
      rootId,
      subtype: 'flowchart',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#10b981', '#6366f1', '#f59e0b', '#ef4444'],
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
