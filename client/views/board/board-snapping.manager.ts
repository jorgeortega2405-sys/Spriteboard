import { getElementBoundingBox } from './board-elements.manager.js';
import { BoardElement, BoardPoint, ResizeHandle } from './board.types.js';

export interface AlignmentGuide {
  end: number;
  position: number;
  snapType: 'center' | 'end' | 'start';
  start: number;
  type: 'horizontal' | 'vertical';
}

export interface SnapResult {
  guides: AlignmentGuide[];
  snappedDx: number;
  snappedDy: number;
}

export interface ResizeSnapResult {
  guides: AlignmentGuide[];
  snappedWorldPos: BoardPoint;
}

export function calculateDragSnapping(
  movingBBox: { height: number; width: number; x: number; y: number },
  rawDx: number,
  rawDy: number,
  referenceElements: BoardElement[],
  allElements: BoardElement[],
  zoom: number,
  thresholdPx = 6
): SnapResult {
  if (referenceElements.length === 0) {
    return { guides: [], snappedDx: rawDx, snappedDy: rawDy };
  }

  const threshold = Math.max(2, thresholdPx / Math.max(0.05, zoom));
  const currentBBox = {
    height: movingBBox.height,
    width: movingBBox.width,
    x: movingBBox.x + rawDx,
    y: movingBBox.y + rawDy,
  };

  const movingX = [
    { type: 'start' as const, val: currentBBox.x },
    { type: 'center' as const, val: currentBBox.x + currentBBox.width / 2 },
    { type: 'end' as const, val: currentBBox.x + currentBBox.width },
  ];

  const movingY = [
    { type: 'start' as const, val: currentBBox.y },
    { type: 'center' as const, val: currentBBox.y + currentBBox.height / 2 },
    { type: 'end' as const, val: currentBBox.y + currentBBox.height },
  ];

  let bestDistX = threshold;
  let bestDiffX: number | null = null;
  let bestDistY = threshold;
  let bestDiffY: number | null = null;

  const refBBoxes = referenceElements.map((el) => getElementBoundingBox(el, allElements));

  for (const refBox of refBBoxes) {
    if (refBox.width <= 0 || refBox.height <= 0) continue;

    const refX = [refBox.x, refBox.x + refBox.width / 2, refBox.x + refBox.width];
    for (const m of movingX) {
      for (const rx of refX) {
        const diff = rx - m.val;
        const dist = Math.abs(diff);
        if (dist < bestDistX) {
          bestDistX = dist;
          bestDiffX = diff;
        }
      }
    }

    const refY = [refBox.y, refBox.y + refBox.height / 2, refBox.y + refBox.height];
    for (const m of movingY) {
      for (const ry of refY) {
        const diff = ry - m.val;
        const dist = Math.abs(diff);
        if (dist < bestDistY) {
          bestDistY = dist;
          bestDiffY = diff;
        }
      }
    }
  }

  const snappedDx = bestDiffX !== null ? rawDx + bestDiffX : rawDx;
  const snappedDy = bestDiffY !== null ? rawDy + bestDiffY : rawDy;

  const finalBBox = {
    height: movingBBox.height,
    width: movingBBox.width,
    x: movingBBox.x + snappedDx,
    y: movingBBox.y + snappedDy,
  };

  const guides: AlignmentGuide[] = [];
  const epsilon = Math.max(0.5, 0.75 / Math.max(0.05, zoom));
  const padding = 16 / Math.max(0.05, zoom);

  if (bestDiffX !== null) {
    const finalMovingX = [
      { type: 'start' as const, val: finalBBox.x },
      { type: 'center' as const, val: finalBBox.x + finalBBox.width / 2 },
      { type: 'end' as const, val: finalBBox.x + finalBBox.width },
    ];

    for (const refBox of refBBoxes) {
      if (refBox.width <= 0 || refBox.height <= 0) continue;
      const refX = [
        { type: 'start' as const, val: refBox.x },
        { type: 'center' as const, val: refBox.x + refBox.width / 2 },
        { type: 'end' as const, val: refBox.x + refBox.width },
      ];

      for (const m of finalMovingX) {
        for (const rx of refX) {
          if (Math.abs(m.val - rx.val) <= epsilon) {
            const start = Math.min(finalBBox.y, refBox.y) - padding;
            const end = Math.max(finalBBox.y + finalBBox.height, refBox.y + refBox.height) + padding;
            guides.push({ end, position: rx.val, snapType: rx.type, start, type: 'vertical' });
          }
        }
      }
    }
  }

  if (bestDiffY !== null) {
    const finalMovingY = [
      { type: 'start' as const, val: finalBBox.y },
      { type: 'center' as const, val: finalBBox.y + finalBBox.height / 2 },
      { type: 'end' as const, val: finalBBox.y + finalBBox.height },
    ];

    for (const refBox of refBBoxes) {
      if (refBox.width <= 0 || refBox.height <= 0) continue;
      const refY = [
        { type: 'start' as const, val: refBox.y },
        { type: 'center' as const, val: refBox.y + refBox.height / 2 },
        { type: 'end' as const, val: refBox.y + refBox.height },
      ];

      for (const m of finalMovingY) {
        for (const ry of refY) {
          if (Math.abs(m.val - ry.val) <= epsilon) {
            const start = Math.min(finalBBox.x, refBox.x) - padding;
            const end = Math.max(finalBBox.x + finalBBox.width, refBox.x + refBox.width) + padding;
            guides.push({ end, position: ry.val, snapType: ry.type, start, type: 'horizontal' });
          }
        }
      }
    }
  }

  return {
    guides: mergeAlignmentGuides(guides),
    snappedDx,
    snappedDy,
  };
}

export function calculateResizeSnapping(
  handle: ResizeHandle,
  rawWorldPos: BoardPoint,
  referenceElements: BoardElement[],
  allElements: BoardElement[],
  zoom: number,
  thresholdPx = 6
): ResizeSnapResult {
  if (referenceElements.length === 0) {
    return { guides: [], snappedWorldPos: { ...rawWorldPos } };
  }

  const threshold = Math.max(2, thresholdPx / Math.max(0.05, zoom));
  const snappedWorldPos = { ...rawWorldPos };
  const guides: AlignmentGuide[] = [];
  const padding = 16 / Math.max(0.05, zoom);

  const refBBoxes = referenceElements.map((el) => getElementBoundingBox(el, allElements));

  const checkHorizontal = handle.includes('e') || handle.includes('w');
  const checkVertical = handle.includes('n') || handle.includes('s');

  if (checkHorizontal) {
    let bestDistX = threshold;
    let bestX: number | null = null;
    let matchedRefBoxX: { height: number; width: number; x: number; y: number } | null = null;
    let matchedTypeX: 'center' | 'end' | 'start' = 'start';

    for (const refBox of refBBoxes) {
      if (refBox.width <= 0 || refBox.height <= 0) continue;
      const refX = [
        { type: 'start' as const, val: refBox.x },
        { type: 'center' as const, val: refBox.x + refBox.width / 2 },
        { type: 'end' as const, val: refBox.x + refBox.width },
      ];

      for (const rx of refX) {
        const dist = Math.abs(rx.val - rawWorldPos.x);
        if (dist < bestDistX) {
          bestDistX = dist;
          bestX = rx.val;
          matchedRefBoxX = refBox;
          matchedTypeX = rx.type;
        }
      }
    }

    if (bestX !== null && matchedRefBoxX) {
      snappedWorldPos.x = bestX;
      const start = Math.min(rawWorldPos.y, matchedRefBoxX.y) - padding;
      const end = Math.max(rawWorldPos.y, matchedRefBoxX.y + matchedRefBoxX.height) + padding;
      guides.push({ end, position: bestX, snapType: matchedTypeX, start, type: 'vertical' });
    }
  }

  if (checkVertical) {
    let bestDistY = threshold;
    let bestY: number | null = null;
    let matchedRefBoxY: { height: number; width: number; x: number; y: number } | null = null;
    let matchedTypeY: 'center' | 'end' | 'start' = 'start';

    for (const refBox of refBBoxes) {
      if (refBox.width <= 0 || refBox.height <= 0) continue;
      const refY = [
        { type: 'start' as const, val: refBox.y },
        { type: 'center' as const, val: refBox.y + refBox.height / 2 },
        { type: 'end' as const, val: refBox.y + refBox.height },
      ];

      for (const ry of refY) {
        const dist = Math.abs(ry.val - rawWorldPos.y);
        if (dist < bestDistY) {
          bestDistY = dist;
          bestY = ry.val;
          matchedRefBoxY = refBox;
          matchedTypeY = ry.type;
        }
      }
    }

    if (bestY !== null && matchedRefBoxY) {
      snappedWorldPos.y = bestY;
      const start = Math.min(rawWorldPos.x, matchedRefBoxY.x) - padding;
      const end = Math.max(rawWorldPos.x, matchedRefBoxY.x + matchedRefBoxY.width) + padding;
      guides.push({ end, position: bestY, snapType: matchedTypeY, start, type: 'horizontal' });
    }
  }

  return {
    guides: mergeAlignmentGuides(guides),
    snappedWorldPos,
  };
}

function mergeAlignmentGuides(guides: AlignmentGuide[]): AlignmentGuide[] {
  const merged: AlignmentGuide[] = [];

  for (const guide of guides) {
    const existing = merged.find(
      (item) => item.type === guide.type && Math.abs(item.position - guide.position) < 0.001
    );
    if (existing) {
      existing.start = Math.min(existing.start, guide.start);
      existing.end = Math.max(existing.end, guide.end);
    } else {
      merged.push({ ...guide });
    }
  }

  return merged;
}
