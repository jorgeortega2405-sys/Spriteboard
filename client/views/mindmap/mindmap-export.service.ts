import { MindMapProject } from '../../types/mindmap.types.js';
import { ComputedNodeLayout } from './mindmap-layout.engine.js';
import { drawBranchConnections, drawCustomConnections, drawKanbanSwimlanes, drawMindMapBackground, drawMindMapNodes } from './mindmap-renderer.js';

function computeProjectBoundingBox(layoutMap: Map<string, ComputedNodeLayout>): { height: number; maxX: number; maxY: number; minX: number; minY: number; width: number } {
  if (layoutMap.size === 0) {
    return { height: 600, maxX: 400, maxY: 300, minX: -400, minY: -300, width: 800 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  layoutMap.forEach((node) => {
    const halfW = node.width / 2;
    const halfH = node.height / 2;
    minX = Math.min(minX, node.x - halfW);
    maxX = Math.max(maxX, node.x + halfW);
    minY = Math.min(minY, node.y - halfH);
    maxY = Math.max(maxY, node.y + halfH);
  });

  const padding = 80;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  return {
    height: Math.max(200, maxY - minY),
    maxX,
    maxY,
    minX,
    minY,
    width: Math.max(300, maxX - minX),
  };
}

export function generateMindMapThumbnail(project: MindMapProject, layoutMap: Map<string, ComputedNodeLayout>): string {
  const bounds = computeProjectBoundingBox(layoutMap);
  const targetW = 320;
  const targetH = 180;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const scaleX = targetW / bounds.width;
  const scaleY = targetH / bounds.height;
  const zoom = Math.min(scaleX, scaleY) * 0.9;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const camera = {
    x: centerX,
    y: centerY,
    zoom,
  };

  drawMindMapBackground(ctx, targetW, targetH, camera);
  if (project.subtype === 'kanban') {
    drawKanbanSwimlanes(ctx, layoutMap, camera, targetW, targetH, project.rootId);
  }
  drawBranchConnections(ctx, layoutMap, camera, targetW, targetH, project.theme, project.subtype);
  drawCustomConnections(ctx, project.connections, layoutMap, camera, targetW, targetH);
  drawMindMapNodes(ctx, layoutMap, camera, targetW, targetH, new Set<string>(), null);

  return canvas.toDataURL('image/png');
}

export async function exportMindMapPng(project: MindMapProject, layoutMap: Map<string, ComputedNodeLayout>, filename = 'mapa-mental.png'): Promise<void> {
  const bounds = computeProjectBoundingBox(layoutMap);
  const scaleFactor = 2;
  const exportW = Math.round(bounds.width * scaleFactor);
  const exportH = Math.round(bounds.height * scaleFactor);

  const canvas = document.createElement('canvas');
  canvas.width = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const camera = {
    x: centerX,
    y: centerY,
    zoom: scaleFactor,
  };

  drawMindMapBackground(ctx, exportW, exportH, camera);
  if (project.subtype === 'kanban') {
    drawKanbanSwimlanes(ctx, layoutMap, camera, exportW, exportH, project.rootId);
  }
  drawBranchConnections(ctx, layoutMap, camera, exportW, exportH, project.theme, project.subtype);
  drawCustomConnections(ctx, project.connections, layoutMap, camera, exportW, exportH);
  drawMindMapNodes(ctx, layoutMap, camera, exportW, exportH, new Set<string>(), null);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export function exportMindMapSvg(project: MindMapProject, layoutMap: Map<string, ComputedNodeLayout>, filename = 'mapa-mental.svg'): void {
  const bounds = computeProjectBoundingBox(layoutMap);
  const width = bounds.width;
  const height = bounds.height;
  const offsetX = -bounds.minX;
  const offsetY = -bounds.minY;

  const bg = '#ffffff';
  let svgPaths = '';

  const isTopDown = project.theme.layoutDirection === 'top-down';

  layoutMap.forEach((node) => {
    if (!node.parentId) return;
    const parent = layoutMap.get(node.parentId);
    if (!parent) return;

    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;

    if (isTopDown) {
      startX = parent.x + offsetX;
      startY = parent.y + offsetY + parent.height / 2;
      endX = node.x + offsetX;
      endY = node.y + offsetY - node.height / 2;
    } else {
      if (node.x >= parent.x) {
        startX = parent.x + offsetX + parent.width / 2;
        endX = node.x + offsetX - node.width / 2;
      } else {
        startX = parent.x + offsetX - parent.width / 2;
        endX = node.x + offsetX + node.width / 2;
      }
      startY = parent.y + offsetY;
      endY = node.y + offsetY;
    }

    const color = node.color || '#6366f1';
    const strokeW = node.depth === 1 ? 3 : 2;

    if (project.theme.lineStyle === 'curved') {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      if (isTopDown) {
        svgPaths += `<path d="M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
      } else {
        svgPaths += `<path d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
      }
    } else if (project.theme.lineStyle === 'orthogonal') {
      const midY = (startY + endY) / 2;
      const midX = (startX + endX) / 2;
      if (isTopDown) {
        svgPaths += `<path d="M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
      } else {
        svgPaths += `<path d="M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
      }
    } else {
      svgPaths += `<path d="M ${startX} ${startY} L ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
    }
  });

  if (project.connections) {
    project.connections.forEach((conn) => {
      const fromNode = layoutMap.get(conn.fromId);
      const toNode = layoutMap.get(conn.toId);
      if (!fromNode || !toNode) return;

      const startX = fromNode.x + offsetX + (toNode.x >= fromNode.x ? fromNode.width / 2 : -fromNode.width / 2);
      const startY = fromNode.y + offsetY;
      const endX = toNode.x + offsetX + (toNode.x >= fromNode.x ? -toNode.width / 2 : toNode.width / 2);
      const endY = toNode.y + offsetY;
      const midX = (startX + endX) / 2;

      svgPaths += `<path d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" fill="none" stroke="${conn.color || '#475569'}" stroke-width="2" stroke-linecap="round" />\n`;
    });
  }

  let svgNodes = '';
  layoutMap.forEach((node) => {
    const cx = node.x + offsetX;
    const cy = node.y + offsetY;
    const x = cx - node.width / 2;
    const y = cy - node.height / 2;
    const color = node.color || '#6366f1';
    const textColor = node.textColor || '#ffffff';
    const escapedText = node.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    let shapeSvg = '';
    if (node.shape === 'diamond') {
      shapeSvg = `<polygon points="${cx},${y} ${x + node.width},${cy} ${cx},${y + node.height} ${x},${cy}" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
    } else if (node.shape === 'parallelogram') {
      const skew = Math.min(16, node.width * 0.16);
      shapeSvg = `<polygon points="${x + skew},${y} ${x + node.width},${y} ${x + node.width - skew},${y + node.height} ${x},${y + node.height}" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
    } else if (node.shape === 'pill') {
      shapeSvg = `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${node.height / 2}" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
    } else if (node.shape === 'rect') {
      shapeSvg = `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="0" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
    } else {
      const rx = node.depth === 0 ? node.height / 2 : 10;
      shapeSvg = `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${rx}" fill="${color}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
    }

    svgNodes += `
      <g>
        ${shapeSvg}
        <text x="${cx}" y="${cy + (node.fontSize / 3)}" font-size="${node.fontSize}" font-weight="600" fill="${textColor}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapedText}</text>
      </g>
    `;
  });

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${bg}" />
  <g id="branches">
    ${svgPaths}
  </g>
  <g id="nodes">
    ${svgNodes}
  </g>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMindMapMarkdown(project: MindMapProject, filename = 'mapa-mental.md'): void {
  const rootNode = project.nodes[project.rootId];
  if (!rootNode) return;

  const childrenMap = new Map<string, string[]>();
  Object.values(project.nodes).forEach((n) => {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n.id);
      childrenMap.set(n.parentId, list);
    }
  });

  let markdown = `# ${rootNode.text}\n\n`;

  function buildBranchMd(nodeId: string, depth: number) {
    const children = childrenMap.get(nodeId) || [];
    children.sort((a, b) => (project.nodes[a]?.orderIndex ?? 0) - (project.nodes[b]?.orderIndex ?? 0));

    children.forEach((childId) => {
      const child = project.nodes[childId];
      if (!child) return;
      const indent = '  '.repeat(depth);
      markdown += `${indent}- ${child.text}\n`;
      buildBranchMd(childId, depth + 1);
    });
  }

  buildBranchMd(project.rootId, 0);

  const freeRoots = Object.values(project.nodes).filter((n) => !n.parentId && n.id !== project.rootId);
  if (freeRoots.length > 0) {
    markdown += `\n## Cuadros e Ideas Libres\n\n`;
    freeRoots.forEach((freeNode) => {
      markdown += `- ${freeNode.text}\n`;
      buildBranchMd(freeNode.id, 1);
    });
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
