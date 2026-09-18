import { MindMapNode, MindMapProject } from '../../types/mindmap.types.js';

export interface ComputedNodeLayout {
  childrenIds: string[];
  color: string;
  depth: number;
  fontSize: number;
  height: number;
  icon?: string;
  id: string;
  isCollapsed: boolean;
  isDone?: boolean;
  isFree?: boolean;
  isTask?: boolean;
  linkingPhrase?: string;
  orderIndex: number;
  parentId: string | null;
  shape: 'diamond' | 'document' | 'parallelogram' | 'pill' | 'rect' | 'rounded' | 'sticky' | 'underline';
  side: 'bottom' | 'center' | 'left' | 'right';
  text: string;
  textColor: string;
  width: number;
  x: number;
  y: number;
}

export function estimateNodeDimensions(node: { icon?: string; isTask?: boolean; shape?: string; text: string }, isRoot: boolean): { height: number; width: number } {
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

export function computeMindMapTreeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
  const layoutMap = new Map<string, ComputedNodeLayout>();
  const nodes = project.nodes;
  const rootId = project.rootId;
  const rootNode = nodes[rootId];
  const isKanban = project.subtype === 'kanban';
  const isTopDown = !isKanban && project.theme?.layoutDirection === 'top-down';

  const childrenMap = new Map<string, string[]>();
  const freeRootIds: string[] = [];

  Object.values(nodes).forEach((n) => {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n.id);
      childrenMap.set(n.parentId, list);
    } else if (n.id !== rootId) {
      freeRootIds.push(n.id);
    }
  });

  childrenMap.forEach((list) => {
    list.sort((a, b) => (nodes[a]?.orderIndex ?? 0) - (nodes[b]?.orderIndex ?? 0));
  });

  if (rootNode) {
    const rootDim = estimateNodeDimensions(rootNode, true);
    const rootX = rootNode.customPos ? rootNode.x : 0;
    const rootY = rootNode.customPos ? rootNode.y : (isKanban ? -120 : 0);

    const rootLayout: ComputedNodeLayout = {
      childrenIds: childrenMap.get(rootId) || [],
      color: rootNode.color || (isKanban ? '#1e293b' : '#6366f1'),
      depth: 0,
      fontSize: 16,
      height: rootDim.height,
      icon: rootNode.icon || (isKanban ? 'view_kanban' : undefined),
      id: rootId,
      isCollapsed: !!rootNode.isCollapsed,
      isDone: rootNode.isDone,
      isTask: rootNode.isTask,
      linkingPhrase: rootNode.linkingPhrase,
      orderIndex: 0,
      parentId: null,
      shape: rootNode.shape || (isTopDown || isKanban ? 'rounded' : 'pill'),
      side: isTopDown || isKanban ? 'bottom' : 'center',
      text: rootNode.text,
      textColor: '#ffffff',
      width: rootDim.width,
      x: rootX,
      y: rootY,
    };
    layoutMap.set(rootId, rootLayout);

    if (isKanban) {
      const colW = 240;
      const colGap = 28;
      const cardGap = 12;

      const columns = childrenMap.get(rootId) || [];
      const totalColsW = columns.length > 0 ? (columns.length * colW + (columns.length - 1) * colGap) : 0;
      const startColX = rootX - totalColsW / 2 + colW / 2;
      const colHeaderY = rootY + rootDim.height / 2 + 65;

      columns.forEach((colId, colIdx) => {
        const colNode = nodes[colId];
        if (!colNode) return;

        const colDim = estimateNodeDimensions(colNode, false);
        const colComputedW = Math.max(colW, colDim.width);
        const autoColX = startColX + colIdx * (colW + colGap);
        const autoColY = colHeaderY;
        const currentColX = colNode.customPos ? colNode.x : autoColX;
        const currentColY = colNode.customPos ? colNode.y : autoColY;
        const colCards = colNode.isCollapsed ? [] : (childrenMap.get(colId) || []);

        layoutMap.set(colId, {
          childrenIds: colCards,
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
          width: colComputedW,
          x: currentColX,
          y: currentColY,
        });

        let nextCardTop = currentColY + colDim.height / 2 + 16;

        const layoutCardAndChildren = (cardId: string, depth: number, indent: number): void => {
          const cardNode = nodes[cardId];
          if (!cardNode) return;

          const cardDim = estimateNodeDimensions(cardNode, false);
          const cardW = Math.max(colW - 12 - indent * 16, cardDim.width);
          const cardH = Math.max(38, cardDim.height);
          const cardCenterY = nextCardTop + cardH / 2;
          const autoCardX = currentColX + (indent > 0 ? indent * 8 : 0);
          const currentCardX = cardNode.customPos ? cardNode.x : autoCardX;
          const currentCardY = cardNode.customPos ? cardNode.y : cardCenterY;
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

        colCards.forEach((cardId) => {
          layoutCardAndChildren(cardId, 2, 0);
        });
      });
    } else if (isTopDown) {
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
            color: node.color || '#3b82f6',
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
            layoutTopDownNode(childId, depth + 1, childCenterX, nextY);
            currentChildLeft += childSubW + hGap;
          });
        }
      };

      layoutTopDownNode(rootId, 0, rootX, rootY);
    } else {
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
          shape: node.shape || 'rounded',
          side,
          text: node.text,
          textColor: node.textColor || '#ffffff',
          width: dim.width,
          x: currentX,
          y: currentY,
        });

        if (children.length > 0) {
          let childYStart = currentY - (subTreeHeight / 2);
          children.forEach((childId, i) => {
            const chH = childHeights[i];
            const childTargetY = childYStart + (chH / 2);
            layoutSubtree(childId, side, depth + 1, currentX, dim.width, childTargetY);
            childYStart += chH + vGap;
          });
        }

        return subTreeHeight;
      };

      const vGapRoot = 30;

      const layoutSide = (branchIds: string[], side: 'left' | 'right') => {
        const totalHeights: number[] = [];
        let combinedH = 0;

        branchIds.forEach((id) => {
          const node = nodes[id];
          if (node) {
            const dim = estimateNodeDimensions(node, false);
            const subH = layoutSubtree(id, side, 1, rootX, rootDim.width, rootY);
            const h = Math.max(dim.height, subH);
            totalHeights.push(h);
            combinedH += h;
          }
        });

        if (branchIds.length > 0) {
          combinedH += (branchIds.length - 1) * vGapRoot;
          let startY = rootY - (combinedH / 2);

          branchIds.forEach((id, i) => {
            const h = totalHeights[i];
            const branchCenterY = startY + (h / 2);
            layoutSubtree(id, side, 1, rootX, rootDim.width, branchCenterY);
            startY += h + vGapRoot;
          });
        }
      };

      layoutSide(rightBranches, 'right');
      layoutSide(leftBranches, 'left');
    }
  }

  freeRootIds.forEach((freeId) => {
    const freeNode = nodes[freeId];
    if (!freeNode) return;

    const dim = estimateNodeDimensions(freeNode, false);
    const children = freeNode.isCollapsed ? [] : (childrenMap.get(freeId) || []);

    layoutMap.set(freeId, {
      childrenIds: children,
      color: freeNode.color || '#3b82f6',
      depth: 1,
      fontSize: 14,
      height: dim.height,
      icon: freeNode.icon,
      id: freeId,
      isCollapsed: !!freeNode.isCollapsed,
      isDone: freeNode.isDone,
      isFree: true,
      isTask: freeNode.isTask,
      linkingPhrase: freeNode.linkingPhrase,
      orderIndex: freeNode.orderIndex ?? 0,
      parentId: null,
      shape: freeNode.shape || 'rounded',
      side: isTopDown ? 'bottom' : 'right',
      text: freeNode.text,
      textColor: freeNode.textColor || '#ffffff',
      width: dim.width,
      x: freeNode.x ?? 0,
      y: freeNode.y ?? 0,
    });

    let currentY = (freeNode.y ?? 0) - (children.length * 25);
    children.forEach((childId) => {
      const chNode = nodes[childId];
      if (chNode) {
        const chDim = estimateNodeDimensions(chNode, false);
        const chX = chNode.customPos ? chNode.x : (freeNode.x ?? 0) + (dim.width / 2) + 60 + (chDim.width / 2);
        const chY = chNode.customPos ? chNode.y : currentY;
        currentY += 50;

        layoutMap.set(childId, {
          childrenIds: childrenMap.get(childId) || [],
          color: chNode.color || freeNode.color || '#3b82f6',
          depth: 2,
          fontSize: 13,
          height: chDim.height,
          icon: chNode.icon,
          id: childId,
          isCollapsed: !!chNode.isCollapsed,
          isDone: chNode.isDone,
          isTask: chNode.isTask,
          linkingPhrase: chNode.linkingPhrase,
          orderIndex: chNode.orderIndex ?? 0,
          parentId: freeId,
          shape: chNode.shape || 'rounded',
          side: isTopDown ? 'bottom' : 'right',
          text: chNode.text,
          textColor: chNode.textColor || '#ffffff',
          width: chDim.width,
          x: chX,
          y: chY,
        });
      }
    });
  });

  return layoutMap;
}
