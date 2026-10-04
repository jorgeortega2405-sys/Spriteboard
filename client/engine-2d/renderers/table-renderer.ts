import { BoardTableElement } from '../types.js';

export function drawResizePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();
  ctx.stroke();
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  el: BoardTableElement,
  selectedCell?: { col: number; row: number; tableId: string } | null,
  zoom = 1
): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(el.x, el.y, el.width, el.height);

  ctx.fillStyle = el.headerBackgroundColor || '#f8fafc';
  ctx.fillRect(el.x, el.y, el.width, rowHeights[0]);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = el.data && el.data[r] && el.data[r][c];
      if (cell && cell.backgroundColor && cell.backgroundColor !== '#ffffff' && cell.backgroundColor !== 'transparent') {
        ctx.fillStyle = cell.backgroundColor;
        ctx.fillRect(xCoords[c], yCoords[r], colWidths[c], rowHeights[r]);
      }
    }
  }

  ctx.strokeStyle = el.borderColor || '#cbd5e1';
  ctx.lineWidth = el.borderWidth || 1;
  ctx.strokeRect(el.x, el.y, el.width, el.height);

  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(el.x, yCoords[r]);
    ctx.lineTo(el.x + el.width, yCoords[r]);
    ctx.stroke();
  }

  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(xCoords[c], el.y);
    ctx.lineTo(xCoords[c], el.y + el.height);
    ctx.stroke();
  }

  const fontSize = el.fontSize || 13;
  ctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = el.data && el.data[r] && el.data[r][c];
      const cellText = typeof cell === 'string' ? cell : (cell?.text || '');
      if (cellText) {
        ctx.fillStyle = (typeof cell === 'object' && cell?.textColor) ? cell.textColor : (r === 0 ? '#0f172a' : '#334155');
        ctx.font = r === 0 ? `600 ${fontSize}px sans-serif` : `400 ${fontSize}px sans-serif`;
        const cellX = xCoords[c] + 8;
        const cellY = yCoords[r] + rowHeights[r] / 2;
        ctx.fillText(cellText, cellX, cellY, colWidths[c] - 16);
      }
    }
  }

  if (selectedCell && selectedCell.tableId === el.id && selectedCell.row < rows && selectedCell.col < cols) {
    const selR = selectedCell.row;
    const selC = selectedCell.col;
    const cellX = xCoords[selC];
    const cellY = yCoords[selR];
    const cellW = colWidths[selC];
    const cellH = rowHeights[selR];

    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(cellX, cellY, cellW, cellH);

    const colPillW = 24 / zoom;
    const colPillH = 14 / zoom;
    const colPillX = cellX + cellW / 2 - colPillW / 2;
    const colPillY = el.y - colPillH - 4 / zoom;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1 / zoom;
    drawResizePill(ctx, colPillX, colPillY, colPillW, colPillH, colPillH / 2);

    ctx.fillStyle = '#64748b';
    const dotRadius = 1.2 / zoom;
    const dotSpacing = 4 / zoom;
    const dotCenterX = colPillX + colPillW / 2;
    const dotCenterY = colPillY + colPillH / 2;
    for (let d = -1; d <= 1; d++) {
      ctx.beginPath();
      ctx.arc(dotCenterX + d * dotSpacing, dotCenterY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    const rowPillW = 14 / zoom;
    const rowPillH = 24 / zoom;
    const rowPillX = el.x - rowPillW - 4 / zoom;
    const rowPillY = cellY + cellH / 2 - rowPillH / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1 / zoom;
    drawResizePill(ctx, rowPillX, rowPillY, rowPillW, rowPillH, rowPillW / 2);

    ctx.fillStyle = '#64748b';
    const rowDotCenterX = rowPillX + rowPillW / 2;
    const rowDotCenterY = rowPillY + rowPillH / 2;
    for (let d = -1; d <= 1; d++) {
      ctx.beginPath();
      ctx.arc(rowDotCenterX, rowDotCenterY + d * dotSpacing, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
