import { colIndexToLetter, coordToCellKey, formatCellValue } from './sheet-formula.engine.js';
import { SheetData, SheetProject, SheetRange } from './sheet.types.js';

export function exportSheetCsv(sheet: SheetData, filename: string = 'hoja-de-calculo.csv'): void {
  const rows: string[] = [];

  for (let r = 0; r < sheet.rowCount; r++) {
    const rowVals: string[] = [];
    let hasData = false;

    for (let c = 0; c < sheet.colCount; c++) {
      const k = coordToCellKey(r, c);
      const cell = sheet.cells[k];
      const val = cell ? (cell.computed !== undefined && cell.computed !== null ? String(cell.computed) : cell.raw || '') : '';
      if (val !== '') hasData = true;

      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        rowVals.push(`"${val.replace(/"/g, '""')}"`);
      } else {
        rowVals.push(val);
      }
    }

    if (hasData) {
      rows.push(rowVals.join(','));
    }
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportSheetExcel(sheet: SheetData, filename: string = 'hoja-de-calculo.xls'): void {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  html += `<head><meta charset="utf-8"/><style>table{border-collapse:collapse;} th,td{border:1px solid #cbd5e1;padding:4px 8px;font-family:sans-serif;font-size:12px;}</style></head><body>`;
  html += `<table><thead><tr><th></th>`;

  for (let c = 0; c < sheet.colCount; c++) {
    html += `<th>${colIndexToLetter(c)}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let r = 0; r < sheet.rowCount; r++) {
    html += `<tr><td>${r + 1}</td>`;
    for (let c = 0; c < sheet.colCount; c++) {
      const k = coordToCellKey(r, c);
      const cell = sheet.cells[k];
      const val = cell ? (cell.computed !== undefined && cell.computed !== null ? String(cell.computed) : cell.raw || '') : '';
      const bg = cell?.backgroundColor ? ` background-color:${cell.backgroundColor};` : '';
      const col = cell?.textColor ? ` color:${cell.textColor};` : '';
      const fw = cell?.bold ? ` font-weight:bold;` : '';
      const fs = cell?.italic ? ` font-style:italic;` : '';
      const style = bg || col || fw || fs ? ` style="${bg}${col}${fw}${fs}"` : '';
      html += `<td${style}>${escapeXml(val)}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

export function exportSheetJson(project: SheetProject, filename: string = 'hoja-de-calculo.json'): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

export function copyRangeToTsv(sheet: SheetData, range: SheetRange): string {
  const lines: string[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const rowVals: string[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) {
      const k = coordToCellKey(r, c);
      const cell = sheet.cells[k];
      const val = cell ? formatCellValue(cell.computed ?? cell.raw, cell.format, cell.decimals ?? 2) : '';
      rowVals.push(val);
    }
    lines.push(rowVals.join('\t'));
  }
  return lines.join('\n');
}

export function generateSheetThumbnail(project: SheetProject): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 320, 180);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 320, 24);
  ctx.fillRect(0, 24, 28, 156);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(320, 24);
  ctx.moveTo(28, 0);
  ctx.lineTo(28, 180);
  ctx.stroke();

  const colW = 58;
  const rowH = 18;

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let c = 0; c < 5; c++) {
    const x = 28 + c * colW;
    ctx.fillText(String.fromCharCode(65 + c), x + colW / 2, 12);
    ctx.beginPath();
    ctx.moveTo(x + colW, 0);
    ctx.lineTo(x + colW, 180);
    ctx.stroke();
  }

  for (let r = 0; r < 9; r++) {
    const y = 24 + r * rowH;
    ctx.fillText(String(r + 1), 14, y + rowH / 2);
    ctx.beginPath();
    ctx.moveTo(0, y + rowH);
    ctx.lineTo(320, y + rowH);
    ctx.stroke();
  }

  const activeSheet = project.sheets.find((s) => s.id === project.activeSheetId) || project.sheets[0];
  if (activeSheet) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';

    for (let r = 0; r < Math.min(8, activeSheet.rowCount); r++) {
      for (let c = 0; c < Math.min(5, activeSheet.colCount); c++) {
        const k = coordToCellKey(r, c);
        const cell = activeSheet.cells[k];
        if (cell) {
          const val = String(cell.computed ?? cell.raw ?? '');
          if (val) {
            const x = 28 + c * colW + 4;
            const y = 24 + r * rowH + rowH / 2;
            ctx.fillText(val.slice(0, 8), x, y);
          }
        }
      }
    }
  }

  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 24, colW, rowH);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
