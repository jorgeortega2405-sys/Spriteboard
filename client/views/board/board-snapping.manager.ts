import { getElementBoundingBox } from './board-elements.manager.js';
import { BoardElement, BoardPoint, ResizeHandle } from './board.types.js';

export interface AlignmentGuide {
  end: number;
  position: number;
  snapType: 'center' | 'end' | 'start';
  start: number;
  type: 'horizontal' | 'vertical';
}

export interface DistanceGuide {
  distance: number;
  end: number;
  isEqualSpacing?: boolean;
  position: number;
  start: number;
  type: 'horizontal' | 'vertical';
}

export interface SnapResult {
  distanceGuides: DistanceGuide[];
  guides: AlignmentGuide[];
  snappedDx: number;
  snappedDy: number;
}

export interface ResizeSnapResult {
  distanceGuides: DistanceGuide[];
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
    return { distanceGuides: [], guides: [], snappedDx: rawDx, snappedDy: rawDy };
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

  const refBBoxes = referenceElements
    .map((el) => getElementBoundingBox(el, allElements))
    .filter((b) => b.width > 0 && b.height > 0);

  // 1. Edge & center alignment snapping
  for (const refBox of refBBoxes) {
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

  // 2. Equal spacing snapping across reference elements (Canva-like equidistant snapping)
  for (let i = 0; i < refBBoxes.length; i++) {
    for (let j = i + 1; j < refBBoxes.length; j++) {
      const box1 = refBBoxes[i];
      const box2 = refBBoxes[j];

      // Horizontal equidistant checks
      const leftBox = box1.x < box2.x ? box1 : box2;
      const rightBox = box1.x < box2.x ? box2 : box1;
      const gapX = rightBox.x - (leftBox.x + leftBox.width);

      // Moving element between leftBox and rightBox
      if (gapX > currentBBox.width) {
        const equalGap = (gapX - currentBBox.width) / 2;
        const targetX = leftBox.x + leftBox.width + equalGap;
        const diffX = targetX - currentBBox.x;
        const dist = Math.abs(diffX);
        if (dist < bestDistX) {
          bestDistX = dist;
          bestDiffX = diffX;
        }
      }

      // Moving element to the right of rightBox with matching gapX
      if (gapX > 2) {
        const targetXRight = rightBox.x + rightBox.width + gapX;
        const diffXRight = targetXRight - currentBBox.x;
        const distRight = Math.abs(diffXRight);
        if (distRight < bestDistX) {
          bestDistX = distRight;
          bestDiffX = diffXRight;
        }

        const targetXLeft = leftBox.x - gapX - currentBBox.width;
        const diffXLeft = targetXLeft - currentBBox.x;
        const distLeft = Math.abs(diffXLeft);
        if (distLeft < bestDistX) {
          bestDistX = distLeft;
          bestDiffX = diffXLeft;
        }
      }

      // Vertical equidistant checks
      const topBox = box1.y < box2.y ? box1 : box2;
      const bottomBox = box1.y < box2.y ? box2 : box1;
      const gapY = bottomBox.y - (topBox.y + topBox.height);

      // Moving element between topBox and bottomBox
      if (gapY > currentBBox.height) {
        const equalGap = (gapY - currentBBox.height) / 2;
        const targetY = topBox.y + topBox.height + equalGap;
        const diffY = targetY - currentBBox.y;
        const dist = Math.abs(diffY);
        if (dist < bestDistY) {
          bestDistY = dist;
          bestDiffY = diffY;
        }
      }

      // Moving element below bottomBox or above topBox
      if (gapY > 2) {
        const targetYBottom = bottomBox.y + bottomBox.height + gapY;
        const diffYBottom = targetYBottom - currentBBox.y;
        const distBottom = Math.abs(diffYBottom);
        if (distBottom < bestDistY) {
          bestDistY = distBottom;
          bestDiffY = diffYBottom;
        }

        const targetYTop = topBox.y - gapY - currentBBox.height;
        const diffYTop = targetYTop - currentBBox.y;
        const distTop = Math.abs(diffYTop);
        if (distTop < bestDistY) {
          bestDistY = distTop;
          bestDiffY = diffYTop;
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
  const distanceGuides: DistanceGuide[] = [];
  const epsilon = Math.max(0.5, 0.75 / Math.max(0.05, zoom));
  const padding = 16 / Math.max(0.05, zoom);

  // 3. Generate alignment lines
  if (bestDiffX !== null) {
    const finalMovingX = [
      { type: 'start' as const, val: finalBBox.x },
      { type: 'center' as const, val: finalBBox.x + finalBBox.width / 2 },
      { type: 'end' as const, val: finalBBox.x + finalBBox.width },
    ];

    for (const refBox of refBBoxes) {
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

  // 4. Generate Distance Guides (Canva-like distance indicators with numbers)
  let foundEqualSpacing = false;

  // Check equal spacing matches for final position
  for (let i = 0; i < refBBoxes.length; i++) {
    for (let j = i + 1; j < refBBoxes.length; j++) {
      const box1 = refBBoxes[i];
      const box2 = refBBoxes[j];

      // Horizontal equal spacing checks
      const leftBox = box1.x < box2.x ? box1 : box2;
      const rightBox = box1.x < box2.x ? box2 : box1;

      // Between left and right
      if (finalBBox.x > leftBox.x + leftBox.width && finalBBox.x + finalBBox.width < rightBox.x) {
        const gap1 = finalBBox.x - (leftBox.x + leftBox.width);
        const gap2 = rightBox.x - (finalBBox.x + finalBBox.width);
        if (Math.abs(gap1 - gap2) <= epsilon && gap1 > 2) {
          foundEqualSpacing = true;
          const pos1 = (leftBox.y + leftBox.height / 2 + finalBBox.y + finalBBox.height / 2) / 2;
          const pos2 = (finalBBox.y + finalBBox.height / 2 + rightBox.y + rightBox.height / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gap1),
            end: finalBBox.x,
            isEqualSpacing: true,
            position: pos1,
            start: leftBox.x + leftBox.width,
            type: 'horizontal',
          });
          distanceGuides.push({
            distance: Math.round(gap2),
            end: rightBox.x,
            isEqualSpacing: true,
            position: pos2,
            start: finalBBox.x + finalBBox.width,
            type: 'horizontal',
          });
        }
      }

      // To the right of rightBox
      if (finalBBox.x > rightBox.x + rightBox.width) {
        const gapAB = rightBox.x - (leftBox.x + leftBox.width);
        const gapBM = finalBBox.x - (rightBox.x + rightBox.width);
        if (gapAB > 2 && gapBM > 2 && Math.abs(gapAB - gapBM) <= epsilon) {
          foundEqualSpacing = true;
          const pos1 = (leftBox.y + leftBox.height / 2 + rightBox.y + rightBox.height / 2) / 2;
          const pos2 = (rightBox.y + rightBox.height / 2 + finalBBox.y + finalBBox.height / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gapAB),
            end: rightBox.x,
            isEqualSpacing: true,
            position: pos1,
            start: leftBox.x + leftBox.width,
            type: 'horizontal',
          });
          distanceGuides.push({
            distance: Math.round(gapBM),
            end: finalBBox.x,
            isEqualSpacing: true,
            position: pos2,
            start: rightBox.x + rightBox.width,
            type: 'horizontal',
          });
        }
      }

      // To the left of leftBox
      if (finalBBox.x + finalBBox.width < leftBox.x) {
        const gapMA = leftBox.x - (finalBBox.x + finalBBox.width);
        const gapAB = rightBox.x - (leftBox.x + leftBox.width);
        if (gapMA > 2 && gapAB > 2 && Math.abs(gapMA - gapAB) <= epsilon) {
          foundEqualSpacing = true;
          const pos1 = (finalBBox.y + finalBBox.height / 2 + leftBox.y + leftBox.height / 2) / 2;
          const pos2 = (leftBox.y + leftBox.height / 2 + rightBox.y + rightBox.height / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gapMA),
            end: leftBox.x,
            isEqualSpacing: true,
            position: pos1,
            start: finalBBox.x + finalBBox.width,
            type: 'horizontal',
          });
          distanceGuides.push({
            distance: Math.round(gapAB),
            end: rightBox.x,
            isEqualSpacing: true,
            position: pos2,
            start: leftBox.x + leftBox.width,
            type: 'horizontal',
          });
        }
      }

      // Vertical equal spacing checks
      const topBox = box1.y < box2.y ? box1 : box2;
      const bottomBox = box1.y < box2.y ? box2 : box1;

      // Between top and bottom
      if (finalBBox.y > topBox.y + topBox.height && finalBBox.y + finalBBox.height < bottomBox.y) {
        const gap1 = finalBBox.y - (topBox.y + topBox.height);
        const gap2 = bottomBox.y - (finalBBox.y + finalBBox.height);
        if (Math.abs(gap1 - gap2) <= epsilon && gap1 > 2) {
          foundEqualSpacing = true;
          const pos1 = (topBox.x + topBox.width / 2 + finalBBox.x + finalBBox.width / 2) / 2;
          const pos2 = (finalBBox.x + finalBBox.width / 2 + bottomBox.x + bottomBox.width / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gap1),
            end: finalBBox.y,
            isEqualSpacing: true,
            position: pos1,
            start: topBox.y + topBox.height,
            type: 'vertical',
          });
          distanceGuides.push({
            distance: Math.round(gap2),
            end: bottomBox.y,
            isEqualSpacing: true,
            position: pos2,
            start: finalBBox.y + finalBBox.height,
            type: 'vertical',
          });
        }
      }

      // Below bottomBox
      if (finalBBox.y > bottomBox.y + bottomBox.height) {
        const gapAB = bottomBox.y - (topBox.y + topBox.height);
        const gapBM = finalBBox.y - (bottomBox.y + bottomBox.height);
        if (gapAB > 2 && gapBM > 2 && Math.abs(gapAB - gapBM) <= epsilon) {
          foundEqualSpacing = true;
          const pos1 = (topBox.x + topBox.width / 2 + bottomBox.x + bottomBox.width / 2) / 2;
          const pos2 = (bottomBox.x + bottomBox.width / 2 + finalBBox.x + finalBBox.width / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gapAB),
            end: bottomBox.y,
            isEqualSpacing: true,
            position: pos1,
            start: topBox.y + topBox.height,
            type: 'vertical',
          });
          distanceGuides.push({
            distance: Math.round(gapBM),
            end: finalBBox.y,
            isEqualSpacing: true,
            position: pos2,
            start: bottomBox.y + bottomBox.height,
            type: 'vertical',
          });
        }
      }

      // Above topBox
      if (finalBBox.y + finalBBox.height < topBox.y) {
        const gapMA = topBox.y - (finalBBox.y + finalBBox.height);
        const gapAB = bottomBox.y - (topBox.y + topBox.height);
        if (gapMA > 2 && gapAB > 2 && Math.abs(gapMA - gapAB) <= epsilon) {
          foundEqualSpacing = true;
          const pos1 = (finalBBox.x + finalBBox.width / 2 + topBox.x + topBox.width / 2) / 2;
          const pos2 = (topBox.x + topBox.width / 2 + bottomBox.x + bottomBox.width / 2) / 2;
          distanceGuides.push({
            distance: Math.round(gapMA),
            end: topBox.y,
            isEqualSpacing: true,
            position: pos1,
            start: finalBBox.y + finalBBox.height,
            type: 'vertical',
          });
          distanceGuides.push({
            distance: Math.round(gapAB),
            end: bottomBox.y,
            isEqualSpacing: true,
            position: pos2,
            start: topBox.y + topBox.height,
            type: 'vertical',
          });
        }
      }
    }
  }

  // If not in 3-element equal spacing, show distances to adjacent/closest elements
  if (!foundEqualSpacing) {
    const maxGap = 500 / Math.max(0.15, zoom);

    for (const refBox of refBBoxes) {
      // Horizontal proximity gap
      const vOverlap = Math.max(0, Math.min(finalBBox.y + finalBBox.height, refBox.y + refBox.height) - Math.max(finalBBox.y, refBox.y));
      const vSpan = Math.max(finalBBox.height, refBox.height);

      if (vOverlap > 0 || Math.abs((finalBBox.y + finalBBox.height / 2) - (refBox.y + refBox.height / 2)) < vSpan * 1.5) {
        if (finalBBox.x > refBox.x + refBox.width) {
          const gap = finalBBox.x - (refBox.x + refBox.width);
          if (gap > 2 && gap <= maxGap) {
            const posY = vOverlap > 0
              ? (Math.max(finalBBox.y, refBox.y) + Math.min(finalBBox.y + finalBBox.height, refBox.y + refBox.height)) / 2
              : (finalBBox.y + finalBBox.height / 2 + refBox.y + refBox.height / 2) / 2;
            distanceGuides.push({
              distance: Math.round(gap),
              end: finalBBox.x,
              position: posY,
              start: refBox.x + refBox.width,
              type: 'horizontal',
            });
          }
        } else if (refBox.x > finalBBox.x + finalBBox.width) {
          const gap = refBox.x - (finalBBox.x + finalBBox.width);
          if (gap > 2 && gap <= maxGap) {
            const posY = vOverlap > 0
              ? (Math.max(finalBBox.y, refBox.y) + Math.min(finalBBox.y + finalBBox.height, refBox.y + refBox.height)) / 2
              : (finalBBox.y + finalBBox.height / 2 + refBox.y + refBox.height / 2) / 2;
            distanceGuides.push({
              distance: Math.round(gap),
              end: refBox.x,
              position: posY,
              start: finalBBox.x + finalBBox.width,
              type: 'horizontal',
            });
          }
        }
      }

      // Vertical proximity gap
      const hOverlap = Math.max(0, Math.min(finalBBox.x + finalBBox.width, refBox.x + refBox.width) - Math.max(finalBBox.x, refBox.x));
      const hSpan = Math.max(finalBBox.width, refBox.width);

      if (hOverlap > 0 || Math.abs((finalBBox.x + finalBBox.width / 2) - (refBox.x + refBox.width / 2)) < hSpan * 1.5) {
        if (finalBBox.y > refBox.y + refBox.height) {
          const gap = finalBBox.y - (refBox.y + refBox.height);
          if (gap > 2 && gap <= maxGap) {
            const posX = hOverlap > 0
              ? (Math.max(finalBBox.x, refBox.x) + Math.min(finalBBox.x + finalBBox.width, refBox.x + refBox.width)) / 2
              : (finalBBox.x + finalBBox.width / 2 + refBox.x + refBox.width / 2) / 2;
            distanceGuides.push({
              distance: Math.round(gap),
              end: finalBBox.y,
              position: posX,
              start: refBox.y + refBox.height,
              type: 'vertical',
            });
          }
        } else if (refBox.y > finalBBox.y + finalBBox.height) {
          const gap = refBox.y - (finalBBox.y + finalBBox.height);
          if (gap > 2 && gap <= maxGap) {
            const posX = hOverlap > 0
              ? (Math.max(finalBBox.x, refBox.x) + Math.min(finalBBox.x + finalBBox.width, refBox.x + refBox.width)) / 2
              : (finalBBox.x + finalBBox.width / 2 + refBox.x + refBox.width / 2) / 2;
            distanceGuides.push({
              distance: Math.round(gap),
              end: refBox.y,
              position: posX,
              start: finalBBox.y + finalBBox.height,
              type: 'vertical',
            });
          }
        }
      }
    }
  }

  return {
    distanceGuides: mergeDistanceGuides(distanceGuides),
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
    return { distanceGuides: [], guides: [], snappedWorldPos: { ...rawWorldPos } };
  }

  const threshold = Math.max(2, thresholdPx / Math.max(0.05, zoom));
  const snappedWorldPos = { ...rawWorldPos };
  const guides: AlignmentGuide[] = [];
  const distanceGuides: DistanceGuide[] = [];
  const padding = 16 / Math.max(0.05, zoom);

  const refBBoxes = referenceElements
    .map((el) => getElementBoundingBox(el, allElements))
    .filter((b) => b.width > 0 && b.height > 0);

  const checkHorizontal = handle.includes('e') || handle.includes('w');
  const checkVertical = handle.includes('n') || handle.includes('s');

  if (checkHorizontal) {
    let bestDistX = threshold;
    let bestX: number | null = null;
    let matchedRefBoxX: { height: number; width: number; x: number; y: number } | null = null;
    let matchedTypeX: 'center' | 'end' | 'start' = 'start';

    for (const refBox of refBBoxes) {
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
    distanceGuides: mergeDistanceGuides(distanceGuides),
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

function mergeDistanceGuides(guides: DistanceGuide[]): DistanceGuide[] {
  const merged: DistanceGuide[] = [];

  for (const guide of guides) {
    const existing = merged.find(
      (item) =>
        item.type === guide.type &&
        Math.abs(item.start - guide.start) < 2 &&
        Math.abs(item.end - guide.end) < 2
    );
    if (!existing) {
      merged.push({ ...guide });
    }
  }

  return merged;
}
