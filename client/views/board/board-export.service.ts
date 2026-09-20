import { showToast } from '../../services/toast.service.js';
import { get3DElementProjectedFaces } from './board-3d-renderer.js';
import { drawChart } from './board-chart-renderer.js';
import { computeElementsBoundingBox, findContainingSection } from './board-elements.manager.js';
import { getSvgPathBoundingBox } from './board-renderer.js';
import { BackgroundType, Board3DElement, BoardElement, BoardPixelGridElement, BoardProject, BoardSectionElement } from './board.types.js';

export function generateThumbnail(
  elements: BoardElement[],
  boardBackground: { color: string; dotColor?: string; type: BackgroundType },
  drawElementFn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void
): string {
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 320;
  thumbCanvas.height = 200;
  const tctx = thumbCanvas.getContext('2d');
  if (!tctx) return '';

  tctx.fillStyle = boardBackground.color;
  tctx.fillRect(0, 0, 320, 200);

  const bbox = computeElementsBoundingBox(elements);
  if (!bbox) {
    tctx.fillStyle = boardBackground.dotColor || '#cbd5e1';
    for (let x = 16; x < 320; x += 32) {
      for (let y = 16; y < 200; y += 32) {
        tctx.beginPath();
        tctx.arc(x, y, 1.5, 0, Math.PI * 2);
        tctx.fill();
      }
    }
    return thumbCanvas.toDataURL('image/png');
  }

  const padding = 24;
  const availW = 320 - padding * 2;
  const availH = 200 - padding * 2;
  const scale = Math.min(availW / Math.max(1, bbox.width), availH / Math.max(1, bbox.height), 1);

  tctx.save();
  tctx.translate(160, 100);
  tctx.scale(scale, scale);
  tctx.translate(-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2));

  const sections = elements.filter((e) => e.type === 'section') as BoardSectionElement[];
  for (const el of elements) {
    if (el.type !== 'section') continue;
    drawElementFn(tctx, el);
  }
  for (const el of elements) {
    if (el.type === 'section') continue;
    const parentSection = findContainingSection(el, sections, elements);
    if (parentSection) {
      tctx.save();
      tctx.beginPath();
      if (typeof tctx.roundRect === 'function') {
        tctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, 8);
      } else {
        tctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
      }
      tctx.clip();
      drawElementFn(tctx, el);
      tctx.restore();
    } else {
      drawElementFn(tctx, el);
    }
  }

  tctx.restore();
  return thumbCanvas.toDataURL('image/png');
}

export function exportPng(
  onlyView: boolean,
  canvasElement: HTMLCanvasElement | null,
  elements: BoardElement[],
  boardBackground: { color: string; dotColor?: string; type: BackgroundType },
  boardName: string,
  drawElementFn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void
): void {
  if (!canvasElement) return;

  if (onlyView) {
    const link = document.createElement('a');
    link.download = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}_vista.png`;
    link.href = canvasElement.toDataURL('image/png');
    link.click();
    showToast('Imagen exportada');
    return;
  }

  const bbox = computeElementsBoundingBox(elements);
  if (!bbox) {
    showToast('El pizarrón está vacío', 'info');
    return;
  }

  const pad = 60;
  let exportW = Math.ceil(bbox.width + pad * 2);
  let exportH = Math.ceil(bbox.height + pad * 2);
  const maxDim = 8192;
  let exportScale = 1;
  if (exportW > maxDim || exportH > maxDim) {
    exportScale = Math.min(maxDim / exportW, maxDim / exportH);
    exportW = Math.max(1, Math.round(exportW * exportScale));
    exportH = Math.max(1, Math.round(exportH * exportScale));
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;
  const ectx = exportCanvas.getContext('2d');
  if (!ectx) return;

  ectx.fillStyle = boardBackground.color;
  ectx.fillRect(0, 0, exportW, exportH);

  ectx.save();
  if (exportScale !== 1) {
    ectx.scale(exportScale, exportScale);
  }
  ectx.translate(pad - bbox.x, pad - bbox.y);

  const pngSections = elements.filter((e) => e.type === 'section') as BoardSectionElement[];
  for (const el of elements) {
    if (el.type !== 'section') continue;
    drawElementFn(ectx, el);
  }
  for (const el of elements) {
    if (el.type === 'section') continue;
    const parentSection = findContainingSection(el, pngSections, elements);
    if (parentSection) {
      ectx.save();
      ectx.beginPath();
      if (typeof ectx.roundRect === 'function') {
        ectx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, 8);
      } else {
        ectx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
      }
      ectx.clip();
      drawElementFn(ectx, el);
      ectx.restore();
    } else {
      drawElementFn(ectx, el);
    }
  }

  ectx.restore();

  const link = document.createElement('a');
  link.download = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  showToast('Imagen PNG exportada con éxito');
  exportCanvas.width = 0;
  exportCanvas.height = 0;
}

export function exportSvg(
  elements: BoardElement[],
  boardBackground: { color: string; dotColor?: string; type: BackgroundType },
  boardName: string,
  getPixelGridCanvas: (el: BoardPixelGridElement) => { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }
): void {
  const bbox = computeElementsBoundingBox(elements);
  if (!bbox) {
    showToast('El pizarrón está vacío', 'info');
    return;
  }

  const escAttr = (val: string | number): string =>
    String(val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const pad = 40;
  const w = Math.ceil(bbox.width + pad * 2);
  const h = Math.ceil(bbox.height + pad * 2);
  const ox = bbox.x - pad;
  const oy = bbox.y - pad;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}">\n`;
  svgContent += `  <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="${escAttr(boardBackground.color)}" />\n`;

  const sections = elements.filter((e) => e.type === 'section') as BoardSectionElement[];
  if (sections.length > 0) {
    svgContent += `  <defs>\n`;
    for (const s of sections) {
      svgContent += `    <clipPath id="section-clip-${escAttr(s.id)}">\n`;
      svgContent += `      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="8" ry="8" />\n`;
      svgContent += `    </clipPath>\n`;
    }
    svgContent += `  </defs>\n`;
  }

  const renderSingleElementSvg = (el: BoardElement): string => {
    let out = '';
    if (el.type === 'stroke' && el.points.length > 0) {
      let d = `M ${el.points[0].x} ${el.points[0].y}`;
      for (let i = 1; i < el.points.length - 1; i++) {
        const xc = (el.points[i].x + el.points[i + 1].x) / 2;
        const yc = (el.points[i].y + el.points[i + 1].y) / 2;
        d += ` Q ${el.points[i].x} ${el.points[i].y}, ${xc} ${yc}`;
      }
      if (el.points.length > 1) {
        const last = el.points[el.points.length - 1];
        d += ` L ${last.x} ${last.y}`;
      }
      out += `  <path d="${d}" fill="none" stroke="${escAttr(el.color)}" stroke-width="${escAttr(el.size)}" stroke-linecap="round" stroke-linejoin="round" opacity="${escAttr(el.opacity !== undefined ? el.opacity : 1)}" ${el.strokeStyle === 'dashed' ? 'stroke-dasharray="10,6"' : el.strokeStyle === 'dashed-short' ? 'stroke-dasharray="5,5"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,4"' : ''} />\n`;
    } else if (el.type === 'shape') {
      const fill = escAttr(el.fillColor);
      const stroke = escAttr(el.strokeWidth > 0 && el.strokeColor !== 'transparent' ? el.strokeColor : 'none');
      const sw = escAttr(el.strokeWidth);
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const dash = el.strokeStyle === 'dashed' ? 'stroke-dasharray="10,6"' : el.strokeStyle === 'dashed-short' ? 'stroke-dasharray="5,5"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,4"' : '';

      if (el.svgPath) {
        const bounds = getSvgPathBoundingBox(el.svgPath);
        const pathW = bounds.width || 48;
        const pathH = bounds.height || 48;
        const minX = bounds.x || 0;
        const minY = bounds.y || 0;
        out += `  <path d="${el.svgPath}" transform="translate(${el.x}, ${el.y}) scale(${el.width / pathW}, ${el.height / pathH}) translate(${-minX}, ${-minY})" fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth * (Math.min(pathW, pathH) / Math.max(el.width, el.height))}" stroke-linejoin="round" stroke-linecap="round" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'rect') {
        const rx = el.borderRadius ? `rx="${el.borderRadius}" ry="${el.borderRadius}"` : '';
        out += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" ${rx} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'round-rect') {
        const rxVal = el.borderRadius !== undefined ? el.borderRadius : 12;
        out += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rxVal}" ry="${rxVal}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'circle') {
        out += `  <ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${Math.abs(el.width) / 2}" ry="${Math.abs(el.height) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'line') {
        out += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${escAttr(el.strokeColor || '#000000')}" stroke-width="${sw}" stroke-linecap="round" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'arrow') {
        const angle = Math.atan2(el.height, el.width);
        const headLen = Math.max(12, el.strokeWidth * 3);
        const x2 = el.x + el.width;
        const y2 = el.y + el.height;
        const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
        const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
        const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
        const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
        out += `  <path d="M ${el.x} ${el.y} L ${x2} ${y2} M ${x2} ${y2} L ${hx1} ${hy1} M ${x2} ${y2} L ${hx2} ${hy2}" fill="none" stroke="${escAttr(el.strokeColor || '#000000')}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'triangle') {
        const p1 = `${el.x + el.width / 2},${el.y}`;
        const p2 = `${el.x + el.width},${el.y + el.height}`;
        const p3 = `${el.x},${el.y + el.height}`;
        out += `  <polygon points="${p1} ${p2} ${p3}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'diamond') {
        const d1 = `${el.x + el.width / 2},${el.y}`;
        const d2 = `${el.x + el.width},${el.y + el.height / 2}`;
        const d3 = `${el.x + el.width / 2},${el.y + el.height}`;
        const d4 = `${el.x},${el.y + el.height / 2}`;
        out += `  <polygon points="${d1} ${d2} ${d3} ${d4}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${dash} opacity="${op}" />\n`;
      } else if (el.shapeType === 'star') {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const spikes = el.sides || 5;
        const outerR = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
        const innerR = outerR / 2.2;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        const pts: string[] = [];
        for (let s = 0; s < spikes; s++) {
          pts.push(`${cx + Math.cos(rot) * outerR},${cy + Math.sin(rot) * outerR}`);
          rot += step;
          pts.push(`${cx + Math.cos(rot) * innerR},${cy + Math.sin(rot) * innerR}`);
          rot += step;
        }
        out += `  <polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${dash} opacity="${op}" />\n`;
      } else {
        out += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} opacity="${op}" />\n`;
      }
    } else if (el.type === 'shape-3d') {
      const faces = get3DElementProjectedFaces(el);
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      out += `  <g opacity="${op}">\n`;
      for (const face of faces) {
        if (face.points.length === 0) continue;
        const ptsStr = face.points.map((p) => `${p.x},${p.y}`).join(' ');
        const fill = escAttr(face.color);
        const stroke = escAttr(face.strokeWidth > 0 && face.strokeColor !== 'transparent' ? face.strokeColor : 'none');
        const sw = escAttr(face.strokeWidth);
        out += `    <polygon points="${ptsStr}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" />\n`;
      }
      out += `  </g>\n`;
    } else if (el.type === 'connector') {
      const p1 = el.startPoint || { x: 0, y: 0 };
      const p2 = el.endPoint || { x: 100, y: 100 };
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const stroke = escAttr(el.color || '#475569');
      const sw = escAttr(el.strokeWidth || 2);
      const dash = el.strokeStyle === 'dashed' ? 'stroke-dasharray="10,6"' : el.strokeStyle === 'dashed-short' ? 'stroke-dasharray="5,5"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,4"' : '';
      out += `  <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${dash} opacity="${op}" />\n`;
    } else if (el.type === 'sticky') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      out += `  <g opacity="${op}">\n`;
      out += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="8" fill="${escAttr(el.color)}" filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.15))" />\n`;
      out += `    <text x="${el.x + 16}" y="${el.y + 24}" fill="${escAttr(el.textColor)}" font-size="${escAttr(el.fontSize)}" font-family="sans-serif">${escAttr(el.text)}</text>\n`;
      out += `  </g>\n`;
    } else if (el.type === 'text') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      out += `  <text x="${el.x}" y="${el.y + el.fontSize}" fill="${escAttr(el.color)}" font-size="${escAttr(el.fontSize)}" font-family="sans-serif" font-weight="600" opacity="${op}">${escAttr(el.text)}</text>\n`;
    } else if (el.type === 'section') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const bg = escAttr(el.backgroundColor || '#ffffff');
      const border = escAttr(el.borderColor || '#cbd5e1');
      const sw = escAttr(el.borderWidth || 1.5);
      const titleColor = escAttr(el.titleColor || '#8b3dff');
      out += `  <g opacity="${op}">\n`;
      out += `    <text x="${el.x}" y="${el.y - 8}" fill="${titleColor}" font-size="15" font-family="sans-serif" font-weight="bold">${escAttr(el.title || 'Sección')}</text>\n`;
      out += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="8" fill="${bg}" stroke="${border}" stroke-width="${sw}" />\n`;
      out += `  </g>\n`;
    } else if (el.type === 'table') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const rows = Math.max(1, el.rows || 3);
      const cols = Math.max(1, el.cols || 3);
      const colWidths = el.colWidths && el.colWidths.length === cols ? el.colWidths : Array(cols).fill(el.width / cols);
      const rowHeights = el.rowHeights && el.rowHeights.length === rows ? el.rowHeights : Array(rows).fill(el.height / rows);
      const xCoords = [el.x];
      for (let c = 0; c < cols; c++) {
        xCoords.push(xCoords[c] + colWidths[c]);
      }
      const yCoords = [el.y];
      for (let r = 0; r < rows; r++) {
        yCoords.push(yCoords[r] + rowHeights[r]);
      }
      const border = escAttr(el.borderColor || '#cbd5e1');
      const sw = escAttr(el.borderWidth || 1);
      const headerBg = escAttr(el.headerBackgroundColor || '#f8fafc');
      out += `  <g opacity="${op}">\n`;
      out += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#ffffff" stroke="${border}" stroke-width="${sw}" />\n`;
      out += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${rowHeights[0]}" fill="${headerBg}" />\n`;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = el.data && el.data[r] && el.data[r][c];
          if (cell && cell.backgroundColor && cell.backgroundColor !== '#ffffff' && cell.backgroundColor !== 'transparent') {
            out += `    <rect x="${xCoords[c]}" y="${yCoords[r]}" width="${colWidths[c]}" height="${rowHeights[r]}" fill="${escAttr(cell.backgroundColor)}" />\n`;
          }
        }
      }
      for (let r = 1; r < rows; r++) {
        out += `    <line x1="${el.x}" y1="${yCoords[r]}" x2="${el.x + el.width}" y2="${yCoords[r]}" stroke="${border}" stroke-width="${sw}" />\n`;
      }
      for (let c = 1; c < cols; c++) {
        out += `    <line x1="${xCoords[c]}" y1="${el.y}" x2="${xCoords[c]}" y2="${el.y + el.height}" stroke="${border}" stroke-width="${sw}" />\n`;
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = el.data && el.data[r] && el.data[r][c];
          const cellText = typeof cell === 'string' ? cell : (cell?.text || '');
          if (cellText) {
            const tc = escAttr((typeof cell === 'object' && cell?.textColor) ? cell.textColor : (r === 0 ? '#0f172a' : '#334155'));
            const fw = r === 0 ? 'bold' : 'normal';
            out += `    <text x="${xCoords[c] + 8}" y="${yCoords[r] + rowHeights[r] / 2 + 4}" fill="${tc}" font-size="13" font-family="sans-serif" font-weight="${fw}">${escAttr(cellText)}</text>\n`;
          }
        }
      }
      out += `  </g>\n`;
    } else if (el.type === 'pixel-grid') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const { canvas } = getPixelGridCanvas(el);
      const dataUrl = canvas.toDataURL('image/png');
      out += `  <image href="${dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" style="image-rendering: pixelated;" opacity="${op}" />\n`;
    } else if (el.type === 'image') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      out += `  <image href="${escAttr(el.url)}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="none" opacity="${op}" />\n`;
    } else if (el.type === 'chart') {
      const op = escAttr(el.opacity !== undefined ? el.opacity : 1);
      const c = document.createElement('canvas');
      c.width = el.width * 2;
      c.height = el.height * 2;
      const cctx = c.getContext('2d');
      if (cctx) {
        cctx.scale(2, 2);
        const tempEl = { ...el, x: 0, y: 0 };
        drawChart(cctx, tempEl);
        const dataUrl = c.toDataURL('image/png');
        out += `  <image href="${dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${op}" />\n`;
      }
    }
    return out;
  };

  for (const el of elements) {
    if (el.type !== 'section') continue;
    svgContent += renderSingleElementSvg(el);
  }

  for (const el of elements) {
    if (el.type === 'section') continue;
    const parentSection = findContainingSection(el, sections, elements);
    if (parentSection) {
      svgContent += `  <g clip-path="url(#section-clip-${escAttr(parentSection.id)})">\n`;
      svgContent += renderSingleElementSvg(el);
      svgContent += `  </g>\n`;
    } else {
      svgContent += renderSingleElementSvg(el);
    }
  }

  svgContent += `</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`;
  link.href = url;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  showToast('Archivo vectorial SVG exportado');
}

export function exportJson(
  elements: BoardElement[],
  boardBackground: { color: string; dotColor?: string; type: BackgroundType },
  camera: { x: number; y: number; zoom: number },
  boardName: string
): void {
  const project: BoardProject = {
    background: boardBackground,
    camera,
    elements,
    type: 'board',
    version: 1,
  };
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  link.href = url;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  showToast('Archivo del proyecto descargado');
}
