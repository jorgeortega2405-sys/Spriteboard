import { MindMapCamera, MindMapConnection, MindMapTheme } from '../../types/mindmap.types.js';
import { ComputedNodeLayout } from './mindmap-layout.engine.js';

export function worldToScreen(wx: number, wy: number, camera: MindMapCamera, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + canvasWidth / 2,
    y: (wy - camera.y) * camera.zoom + canvasHeight / 2,
  };
}

export function screenToWorld(sx: number, sy: number, camera: MindMapCamera, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  return {
    x: (sx - canvasWidth / 2) / camera.zoom + camera.x,
    y: (sy - canvasHeight / 2) / camera.zoom + camera.y,
  };
}

export function drawMindMapBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: MindMapCamera
): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const topLeft = screenToWorld(0, 0, camera, width, height);
  const bottomRight = screenToWorld(width, height, camera, width, height);

  let spacing = 32;
  while (spacing * camera.zoom < 20) {
    spacing *= 2;
  }

  const startX = Math.floor(topLeft.x / spacing) * spacing;
  const endX = Math.ceil(bottomRight.x / spacing) * spacing;
  const startY = Math.floor(topLeft.y / spacing) * spacing;
  const endY = Math.ceil(bottomRight.y / spacing) * spacing;

  ctx.fillStyle = '#cbd5e1';
  const dotRadius = Math.max(1, 1.2 * Math.min(1.5, camera.zoom));

  ctx.beginPath();
  for (let x = startX; x <= endX; x += spacing) {
    for (let y = startY; y <= endY; y += spacing) {
      const screenPt = worldToScreen(x, y, camera, width, height);
      ctx.moveTo(screenPt.x + dotRadius, screenPt.y);
      ctx.arc(screenPt.x, screenPt.y, dotRadius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

export function drawKanbanSwimlanes(
  ctx: CanvasRenderingContext2D,
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number,
  rootId: string
): void {
  const root = layoutMap.get(rootId);
  if (!root || !root.childrenIds || root.childrenIds.length === 0) return;

  ctx.save();

  root.childrenIds.forEach((colId) => {
    const col = layoutMap.get(colId);
    if (!col) return;

    const cardNodes: ComputedNodeLayout[] = [];
    const collectDescendants = (nodeId: string) => {
      const node = layoutMap.get(nodeId);
      if (!node) return;
      node.childrenIds.forEach((childId) => {
        const child = layoutMap.get(childId);
        if (child) {
          cardNodes.push(child);
          collectDescendants(childId);
        }
      });
    };
    collectDescendants(colId);

    const paddingX = 10;
    const paddingTop = 8;
    const paddingBottom = 16;
    const colScreen = worldToScreen(col.x, col.y, camera, canvasW, canvasH);
    const colW = (col.width + paddingX * 2) * camera.zoom;
    const colLeft = colScreen.x - colW / 2;
    const colTop = colScreen.y - ((col.height / 2) + paddingTop) * camera.zoom;

    let maxBottomY = col.y + col.height / 2;
    if (cardNodes.length > 0) {
      cardNodes.forEach((card) => {
        const bottom = card.y + card.height / 2;
        if (bottom > maxBottomY) maxBottomY = bottom;
      });
    } else {
      maxBottomY += 120;
    }

    const bottomScreen = worldToScreen(col.x, maxBottomY + paddingBottom, camera, canvasW, canvasH);
    const colH = Math.max(160 * camera.zoom, bottomScreen.y - colTop);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);
    drawRoundedRect(ctx, colLeft, colTop, colW, colH, 12 * camera.zoom);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = col.color || '#3b82f6';
    drawRoundedRect(ctx, colLeft + 4 * camera.zoom, colTop + 2 * camera.zoom, colW - 8 * camera.zoom, 4 * camera.zoom, 2 * camera.zoom);
    ctx.fill();
  });

  ctx.restore();
}

export function drawBranchConnections(
  ctx: CanvasRenderingContext2D,
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number,
  theme: MindMapTheme,
  subtype?: string
): void {
  ctx.save();
  const isKanban = subtype === 'kanban';
  const lineStyle = theme.lineStyle || 'curved';
  const isTopDown = isKanban || theme.layoutDirection === 'top-down';

  layoutMap.forEach((node) => {
    if (!node.parentId) return;
    const parent = layoutMap.get(node.parentId);
    if (!parent) return;

    if (isKanban && node.depth > 1) {
      return;
    }

    const parentScreen = worldToScreen(parent.x, parent.y, camera, canvasW, canvasH);
    const nodeScreen = worldToScreen(node.x, node.y, camera, canvasW, canvasH);

    const parentHalfW = (parent.width * camera.zoom) / 2;
    const parentHalfH = (parent.height * camera.zoom) / 2;
    const nodeHalfW = (node.width * camera.zoom) / 2;
    const nodeHalfH = (node.height * camera.zoom) / 2;

    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;

    if (isTopDown) {
      startX = parentScreen.x;
      startY = parentScreen.y + parentHalfH;
      endX = nodeScreen.x;
      endY = nodeScreen.y - nodeHalfH;
    } else {
      if (node.x >= parent.x) {
        startX = parentScreen.x + parentHalfW;
        endX = nodeScreen.x - nodeHalfW;
      } else {
        startX = parentScreen.x - parentHalfW;
        endX = nodeScreen.x + nodeHalfW;
      }
      startY = parentScreen.y;
      endY = nodeScreen.y;
    }

    const branchColor = node.color || '#6366f1';
    ctx.beginPath();
    ctx.strokeStyle = branchColor;
    ctx.lineWidth = Math.max(1.5, (node.depth === 1 ? 2.5 : 1.8) * camera.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isTopDown) {
      if (lineStyle === 'curved') {
        const midY = (startY + endY) / 2;
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(startX, midY, endX, midY, endX, endY);
      } else if (lineStyle === 'orthogonal') {
        const midY = (startY + endY) / 2;
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, midY);
        ctx.lineTo(endX, midY);
        ctx.lineTo(endX, endY);
      } else {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();

      const arrowLen = 7 * camera.zoom;
      ctx.fillStyle = branchColor;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowLen * 0.6, endY - arrowLen);
      ctx.lineTo(endX + arrowLen * 0.6, endY - arrowLen);
      ctx.closePath();
      ctx.fill();

      if (node.linkingPhrase) {
        const labelX = (startX + endX) / 2;
        const labelY = (startY + endY) / 2;
        ctx.save();
        ctx.font = `600 ${Math.max(10, 11 * camera.zoom)}px system-ui, -apple-system, sans-serif`;
        const textW = ctx.measureText(node.linkingPhrase).width;
        const pillW = textW + 14 * camera.zoom;
        const pillH = 18 * camera.zoom;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.linkingPhrase, labelX, labelY);
        ctx.restore();
      }
    } else {
      if (lineStyle === 'curved') {
        const midX = (startX + endX) / 2;
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      } else if (lineStyle === 'orthogonal') {
        const midX = (startX + endX) / 2;
        ctx.moveTo(startX, startY);
        ctx.lineTo(midX, startY);
        ctx.lineTo(midX, endY);
        ctx.lineTo(endX, endY);
      } else {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();

      if (node.linkingPhrase) {
        const labelX = (startX + endX) / 2;
        const labelY = (startY + endY) / 2;
        ctx.save();
        ctx.font = `600 ${Math.max(10, 11 * camera.zoom)}px system-ui, -apple-system, sans-serif`;
        const textW = ctx.measureText(node.linkingPhrase).width;
        const pillW = textW + 14 * camera.zoom;
        const pillH = 18 * camera.zoom;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.linkingPhrase, labelX, labelY);
        ctx.restore();
      }
    }
  });

  ctx.restore();
}

export function drawCustomConnections(
  ctx: CanvasRenderingContext2D,
  connections: MindMapConnection[] | undefined,
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number,
  selectedConnId?: string | null
): void {
  if (!connections || connections.length === 0) return;

  ctx.save();

  connections.forEach((conn) => {
    const fromNode = layoutMap.get(conn.fromId);
    const toNode = layoutMap.get(conn.toId);
    if (!fromNode || !toNode) return;

    const fromScreen = worldToScreen(fromNode.x, fromNode.y, camera, canvasW, canvasH);
    const toScreen = worldToScreen(toNode.x, toNode.y, camera, canvasW, canvasH);

    const fromHalfW = (fromNode.width * camera.zoom) / 2;
    const toHalfW = (toNode.width * camera.zoom) / 2;

    let startX = fromScreen.x;
    let startY = fromScreen.y;
    let endX = toScreen.x;
    let endY = toScreen.y;

    if (toNode.x >= fromNode.x) {
      startX = fromScreen.x + fromHalfW;
      endX = toScreen.x - toHalfW;
    } else {
      startX = fromScreen.x - fromHalfW;
      endX = toScreen.x + toHalfW;
    }

    const isSelected = conn.id === selectedConnId;
    const color = isSelected ? '#0284c7' : (conn.color || '#475569');

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = (isSelected ? 3 : 2) * camera.zoom;
    ctx.setLineDash(conn.style === 'orthogonal' ? [6, 4] : []);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const midX = (startX + endX) / 2;
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    const arrowAngle = Math.atan2(endY - startY, endX - midX);
    const arrowLen = 10 * camera.zoom;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLen * Math.cos(arrowAngle - Math.PI / 7),
      endY - arrowLen * Math.sin(arrowAngle - Math.PI / 7)
    );
    ctx.lineTo(
      endX - arrowLen * Math.cos(arrowAngle + Math.PI / 7),
      endY - arrowLen * Math.sin(arrowAngle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    if (conn.label) {
      const labelX = (startX + endX) / 2;
      const labelY = (startY + endY) / 2;
      ctx.save();
      ctx.font = `600 ${11 * camera.zoom}px sans-serif`;
      const textW = ctx.measureText(conn.label).width;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, labelX - textW / 2 - 6, labelY - 9 * camera.zoom, textW + 12, 18 * camera.zoom, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(conn.label, labelX, labelY);
      ctx.restore();
    }
  });

  ctx.restore();
}

export function drawConnectionDraft(
  ctx: CanvasRenderingContext2D,
  fromNodeId: string,
  targetMouseWorld: { x: number; y: number },
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number
): void {
  const fromNode = layoutMap.get(fromNodeId);
  if (!fromNode) return;

  ctx.save();
  const fromScreen = worldToScreen(fromNode.x, fromNode.y, camera, canvasW, canvasH);
  const targetScreen = worldToScreen(targetMouseWorld.x, targetMouseWorld.y, camera, canvasW, canvasH);

  const fromHalfW = (fromNode.width * camera.zoom) / 2;
  const startX = targetMouseWorld.x >= fromNode.x ? fromScreen.x + fromHalfW : fromScreen.x - fromHalfW;
  const startY = fromScreen.y;

  ctx.beginPath();
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2 * camera.zoom;
  ctx.setLineDash([6, 4]);

  const midX = (startX + targetScreen.x) / 2;
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(midX, startY, midX, targetScreen.y, targetScreen.x, targetScreen.y);
  ctx.stroke();

  ctx.restore();
}

export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  startWorld: { x: number; y: number },
  currentWorld: { x: number; y: number },
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number
): void {
  ctx.save();
  const p1 = worldToScreen(Math.min(startWorld.x, currentWorld.x), Math.min(startWorld.y, currentWorld.y), camera, canvasW, canvasH);
  const p2 = worldToScreen(Math.max(startWorld.x, currentWorld.x), Math.max(startWorld.y, currentWorld.y), camera, canvasW, canvasH);

  const w = p2.x - p1.x;
  const h = p2.y - p1.y;

  ctx.fillStyle = 'rgba(2, 132, 199, 0.1)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  ctx.fillRect(p1.x, p1.y, w, h);
  ctx.strokeRect(p1.x, p1.y, w, h);
  ctx.restore();
}

export function drawMindMapNodes(
  ctx: CanvasRenderingContext2D,
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number,
  selectedNodeIds: Set<string>,
  hoveredNodeId: string | null,
  dropTargetNodeId: string | null = null
): void {
  ctx.save();

  layoutMap.forEach((node) => {
    const screen = worldToScreen(node.x, node.y, camera, canvasW, canvasH);
    const w = node.width * camera.zoom;
    const h = node.height * camera.zoom;
    const left = screen.x - w / 2;
    const top = screen.y - h / 2;
    const isSelected = selectedNodeIds.has(node.id);
    const isHovered = node.id === hoveredNodeId;
    const isDropTarget = node.id === dropTargetNodeId;

    const shape = node.shape || 'rounded';
    const skew = Math.min(16 * camera.zoom, w * 0.16);
    const wave = 6 * camera.zoom;

    if (isDropTarget) {
      ctx.save();
      const ringPadding = 8 * camera.zoom;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3 * camera.zoom;
      ctx.setLineDash([4, 4]);
      if (shape === 'diamond') {
        drawDiamond(ctx, screen.x, screen.y, w + ringPadding * 2, h + ringPadding * 2);
      } else if (shape === 'parallelogram') {
        drawParallelogram(ctx, left - ringPadding, top - ringPadding, w + ringPadding * 2, h + ringPadding * 2, skew);
      } else {
        drawRoundedRect(ctx, left - ringPadding, top - ringPadding, w + ringPadding * 2, h + ringPadding * 2, (h + ringPadding * 2) / 2);
      }
      ctx.stroke();
      ctx.restore();
    } else if (isSelected || isHovered) {
      ctx.save();
      const ringPadding = (isSelected ? 4 : 2) * camera.zoom;
      ctx.strokeStyle = isSelected ? '#0284c7' : 'rgba(2, 132, 199, 0.4)';
      ctx.lineWidth = (isSelected ? 2.5 : 1.5) * camera.zoom;
      ctx.setLineDash(isSelected ? [] : [4, 4]);
      if (shape === 'diamond') {
        drawDiamond(ctx, screen.x, screen.y, w + ringPadding * 2, h + ringPadding * 2);
      } else if (shape === 'parallelogram') {
        drawParallelogram(ctx, left - ringPadding, top - ringPadding, w + ringPadding * 2, h + ringPadding * 2, skew);
      } else {
        drawRoundedRect(ctx, left - ringPadding, top - ringPadding, w + ringPadding * 2, h + ringPadding * 2, (h + ringPadding * 2) / 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 6 * camera.zoom;
    ctx.shadowOffsetY = 2 * camera.zoom;

    ctx.fillStyle = node.color || '#6366f1';

    if (shape === 'pill') {
      drawRoundedRect(ctx, left, top, w, h, h / 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      drawDiamond(ctx, screen.x, screen.y, w, h);
      ctx.fill();
    } else if (shape === 'parallelogram') {
      drawParallelogram(ctx, left, top, w, h, skew);
      ctx.fill();
    } else if (shape === 'document') {
      drawDocument(ctx, left, top, w, h, wave);
      ctx.fill();
    } else if (shape === 'sticky') {
      ctx.fillStyle = node.color || '#fef08a';
      drawRoundedRect(ctx, left, top, w, h, 4);
      ctx.fill();
    } else if (shape === 'rect') {
      ctx.fillRect(left, top, w, h);
    } else if (shape === 'underline') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(left, top, w, h);
      ctx.fillStyle = node.color || '#6366f1';
      ctx.fillRect(left, top + h - 3 * camera.zoom, w, 3 * camera.zoom);
    } else {
      const radius = node.depth === 0 ? h / 2 : Math.min(10 * camera.zoom, h / 2);
      drawRoundedRect(ctx, left, top, w, h, radius);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2 * camera.zoom;
    if (shape === 'pill') {
      drawRoundedRect(ctx, left, top, w, h, h / 2);
      ctx.stroke();
    } else if (shape === 'diamond') {
      drawDiamond(ctx, screen.x, screen.y, w, h);
      ctx.stroke();
    } else if (shape === 'parallelogram') {
      drawParallelogram(ctx, left, top, w, h, skew);
      ctx.stroke();
    } else if (shape === 'document') {
      drawDocument(ctx, left, top, w, h, wave);
      ctx.stroke();
    } else if (shape === 'rounded') {
      drawRoundedRect(ctx, left, top, w, h, Math.min(10 * camera.zoom, h / 2));
      ctx.stroke();
    } else if (shape === 'rect') {
      ctx.strokeRect(left, top, w, h);
    }

    ctx.save();
    const isUnderline = shape === 'underline';
    const isSticky = shape === 'sticky';
    ctx.fillStyle = isUnderline || isSticky ? '#1e293b' : (node.textColor || '#ffffff');
    ctx.font = `600 ${Math.max(9, node.fontSize * camera.zoom)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let prefix = '';
    if (node.isTask) {
      prefix += node.isDone ? '☑ ' : '☐ ';
    }
    if (node.icon) {
      prefix += `${node.icon} `;
    }

    const fullText = prefix + node.text;
    const maxTextW = w - 16 * camera.zoom;
    ctx.fillText(fullText, screen.x, screen.y, maxTextW > 0 ? maxTextW : undefined);

    if (node.isTask && node.isDone) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      const textW = Math.min(maxTextW, ctx.measureText(fullText).width);
      ctx.beginPath();
      ctx.moveTo(screen.x - textW / 2, screen.y);
      ctx.lineTo(screen.x + textW / 2, screen.y);
      ctx.stroke();
    }
    ctx.restore();

    if ((isSelected || isHovered) && camera.zoom > 0.4) {
      const handleRadius = 4.5 * camera.zoom;
      const rightHandleX = left + w;
      const leftHandleX = left;
      const handleY = screen.y;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5 * camera.zoom;

      ctx.beginPath();
      ctx.arc(rightHandleX, handleY, handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(leftHandleX, handleY, handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (node.childrenIds.length > 0) {
      const badgeX = node.side === 'left' ? left - 9 * camera.zoom : left + w + 9 * camera.zoom;
      ctx.fillStyle = node.isCollapsed ? '#0284c7' : '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2 * camera.zoom;
      ctx.beginPath();
      ctx.arc(badgeX, screen.y, 8 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = node.isCollapsed ? '#ffffff' : '#0284c7';
      ctx.font = `700 ${8 * camera.zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.isCollapsed ? `+${node.childrenIds.length}` : '-', badgeX, screen.y);
    }
  });

  ctx.restore();
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  layoutMap: Map<string, ComputedNodeLayout>,
  camera: MindMapCamera,
  canvasW: number,
  canvasH: number
): void {
  if (layoutMap.size === 0) return;

  const miniW = 160;
  const miniH = 100;
  const margin = 16;
  const x0 = canvasW - miniW - margin;
  const y0 = canvasH - miniH - margin - 48;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 8;
  drawRoundedRect(ctx, x0, y0, miniW, miniH, 8);
  ctx.fill();
  ctx.stroke();

  let minX = -400;
  let maxX = 400;
  let minY = -300;
  let maxY = 300;

  layoutMap.forEach((n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  });

  const spanX = maxX - minX + 200;
  const spanY = maxY - minY + 200;
  const scale = Math.min((miniW - 16) / spanX, (miniH - 16) / spanY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  layoutMap.forEach((n) => {
    const mx = x0 + miniW / 2 + (n.x - midX) * scale;
    const my = y0 + miniH / 2 + (n.y - midY) * scale;
    ctx.fillStyle = n.color || '#6366f1';
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const viewLeft = camera.x - canvasW / (2 * camera.zoom);
  const viewTop = camera.y - canvasH / (2 * camera.zoom);
  const viewW = canvasW / camera.zoom;
  const viewH = canvasH / camera.zoom;

  const vScreenX = x0 + miniW / 2 + (viewLeft + viewW / 2 - midX) * scale - (viewW * scale) / 2;
  const vScreenY = y0 + miniH / 2 + (viewTop + viewH / 2 - midY) * scale - (viewH * scale) / 2;

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(vScreenX, vScreenY, viewW * scale, viewH * scale);

  ctx.restore();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function drawParallelogram(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, skew: number): void {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawDocument(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wave: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - wave);
  ctx.bezierCurveTo(
    x + w * 0.75, y + h - wave * 2.2,
    x + w * 0.25, y + h + wave * 0.8,
    x, y + h - wave
  );
  ctx.closePath();
}
