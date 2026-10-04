import { getConnectorEndpoints } from '../elements.manager.js';
import { BoardConnectorElement, BoardElement, BoardPoint, MarkerType } from '../types.js';
import { applyLineDash } from './image-cache.util.js';

export function drawEndpointMarker(
  ctx: CanvasRenderingContext2D,
  marker: boolean | MarkerType | undefined,
  pt: BoardPoint,
  angle: number,
  strokeWidth: number,
  color: string
): void {
  if (!marker || marker === 'none') return;
  const size = Math.max(10, strokeWidth * 3.2);
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.rotate(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, strokeWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  if (marker === true || marker === 'arrow-filled') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.45);
    ctx.lineTo(-size * 0.75, 0);
    ctx.lineTo(-size, size * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (marker === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size * 0.5);
    ctx.stroke();
  } else if (marker === 'circle-filled') {
    const r = Math.max(4.5, strokeWidth * 1.6);
    ctx.beginPath();
    ctx.arc(-r, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (marker === 'circle') {
    const r = Math.max(4.5, strokeWidth * 1.6);
    ctx.beginPath();
    ctx.arc(-r, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  } else if (marker === 'square-filled') {
    const s = Math.max(6, strokeWidth * 2.2);
    ctx.fillRect(-s, -s / 2, s, s);
  } else if (marker === 'square') {
    const s = Math.max(6, strokeWidth * 2.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s, -s / 2, s, s);
    ctx.strokeRect(-s, -s / 2, s, s);
  } else if (marker === 'diamond-filled') {
    const s = Math.max(7, strokeWidth * 2.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s / 2, -s / 3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s / 2, s / 3);
    ctx.closePath();
    ctx.fill();
  } else if (marker === 'diamond') {
    const s = Math.max(7, strokeWidth * 2.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s / 2, -s / 3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s / 2, s / 3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  } else if (marker === 'bar') {
    const h = Math.max(8, strokeWidth * 3);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, h / 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawConnector(
  ctx: CanvasRenderingContext2D,
  connector: BoardConnectorElement,
  elements: BoardElement[]
): void {
  const { from, to } = getConnectorEndpoints(connector, elements);

  ctx.save();
  ctx.globalAlpha = connector.opacity !== undefined ? connector.opacity : 1;
  ctx.strokeStyle = connector.color || '#475569';
  ctx.fillStyle = connector.color || '#475569';
  ctx.lineWidth = connector.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyLineDash(ctx, connector.strokeStyle, connector.strokeWidth || 2);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  let angleEnd = Math.atan2(to.y - from.y, to.x - from.x);
  let angleStart = Math.atan2(from.y - to.y, from.x - to.x);
  let midPoint: BoardPoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  if (connector.style === 'curved') {
    const dx = to.x - from.x;
    const cx1 = from.x + dx * 0.5;
    const cy1 = from.y;
    const cx2 = from.x + dx * 0.5;
    const cy2 = to.y;
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y);
    angleEnd = Math.atan2(to.y - cy2, to.x - cx2);
    angleStart = Math.atan2(from.y - cy1, from.x - cx1);
    midPoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  } else if (connector.style === 'orthogonal') {
    const midX = (from.x + to.x) / 2;
    ctx.lineTo(midX, from.y);
    ctx.lineTo(midX, to.y);
    ctx.lineTo(to.x, to.y);
    angleEnd = Math.atan2(0, to.x - midX);
    angleStart = Math.atan2(0, from.x - midX);
    midPoint = { x: midX, y: (from.y + to.y) / 2 };
  } else {
    ctx.lineTo(to.x, to.y);
  }
  ctx.stroke();

  const strokeW = connector.strokeWidth || 2;
  const col = connector.color || '#475569';

  if (connector.arrowEnd !== false && connector.arrowEnd !== 'none') {
    const marker = connector.arrowEnd === true || connector.arrowEnd === undefined ? 'arrow-filled' : connector.arrowEnd;
    drawEndpointMarker(ctx, marker, to, angleEnd, strokeW, col);
  }

  if (connector.arrowStart && connector.arrowStart !== 'none') {
    const marker = connector.arrowStart === true ? 'arrow-filled' : connector.arrowStart;
    drawEndpointMarker(ctx, marker, from, angleStart, strokeW, col);
  }

  if (connector.label) {
    ctx.font = `500 ${connector.fontSize || 12}px sans-serif`;
    const tw = ctx.measureText(connector.label).width;
    const bh = 22;
    const bw = tw + 16;
    const bx = midPoint.x - bw / 2;
    const by = midPoint.y - bh / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = connector.color || '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bx, by, bw, bh, 4);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(connector.label, midPoint.x, midPoint.y);
  }

  ctx.restore();
}
