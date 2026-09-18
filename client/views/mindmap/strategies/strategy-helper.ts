import { MindMapNode, MindMapProject } from '../../../types/mindmap.types.js';
import { ComputedNodeLayout } from './diagram-strategy.interface.js';

export function estimateNodeDimensions(
  node: { icon?: string; isTask?: boolean; shape?: string; text: string },
  isRoot: boolean
): { height: number; width: number } {
  const cleanText = node.text.trim() || 'Idea';
  let paddingX = isRoot ? 32 : 24;
  if (node.icon) paddingX += 22;
  if (node.isTask) paddingX += 22;

  const approxCharWidth = isRoot ? 9.5 : 7.5;
  let calculatedWidth = Math.max(isRoot ? 140 : 100, Math.min(360, cleanText.length * approxCharWidth + paddingX));
  let height = isRoot ? 48 : 38;

  if (node.shape === 'diamond') {
    calculatedWidth = Math.max(isRoot ? 150 : 120, Math.round(calculatedWidth * 1.3));
    height = Math.max(isRoot ? 56 : 48, Math.round(height * 1.25));
  } else if (node.shape === 'parallelogram') {
    calculatedWidth += 24;
  } else if (node.shape === 'document') {
    height += 8;
  }

  return { height, width: calculatedWidth };
}

export function buildChildrenMap(project: MindMapProject): {
  childrenMap: Map<string, string[]>;
  freeRootIds: string[];
} {
  const childrenMap = new Map<string, string[]>();
  const freeRootIds: string[] = [];

  Object.values(project.nodes).forEach((n) => {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n.id);
      childrenMap.set(n.parentId, list);
    } else if (n.id !== project.rootId) {
      freeRootIds.push(n.id);
    }
  });

  childrenMap.forEach((list) => {
    list.sort((a, b) => (project.nodes[a]?.orderIndex ?? 0) - (project.nodes[b]?.orderIndex ?? 0));
  });

  return { childrenMap, freeRootIds };
}

export function layoutFreeNodes(
  project: MindMapProject,
  layoutMap: Map<string, ComputedNodeLayout>,
  childrenMap: Map<string, string[]>,
  freeRootIds: string[]
): void {
  const nodes = project.nodes;

  const layoutFreeSubtree = (nodeId: string, depth: number, parentX: number, startY: number): void => {
    const node = nodes[nodeId];
    if (!node) return;

    const dim = estimateNodeDimensions(node, false);
    const children = node.isCollapsed ? [] : (childrenMap.get(nodeId) || []);
    const currentX = node.customPos ? node.x : parentX;
    const currentY = node.customPos ? node.y : startY;

    layoutMap.set(nodeId, {
      childrenIds: children,
      color: node.color || '#64748b',
      depth,
      fontSize: Math.max(12, 14 - depth),
      height: dim.height,
      icon: node.icon,
      id: nodeId,
      isCollapsed: !!node.isCollapsed,
      isDone: node.isDone,
      isFree: true,
      isTask: node.isTask,
      linkingPhrase: node.linkingPhrase,
      orderIndex: node.orderIndex ?? 0,
      parentId: node.parentId,
      shape: node.shape || 'rounded',
      side: 'right',
      text: node.text,
      textColor: node.textColor || '#ffffff',
      width: dim.width,
      x: currentX,
      y: currentY,
    });

    let nextChildY = currentY - ((children.length - 1) * 48) / 2;
    children.forEach((childId) => {
      layoutFreeSubtree(childId, depth + 1, currentX + dim.width / 2 + 60, nextChildY);
      nextChildY += 52;
    });
  };

  freeRootIds.forEach((freeId, idx) => {
    const freeNode = nodes[freeId];
    if (!freeNode) return;
    const defaultX = freeNode.customPos ? freeNode.x : 380;
    const defaultY = freeNode.customPos ? freeNode.y : -160 + idx * 80;
    layoutFreeSubtree(freeId, 0, defaultX, defaultY);
  });
}

export function generateId(prefix = 'node'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}
