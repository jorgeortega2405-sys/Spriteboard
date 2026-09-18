import { getLoadedGoogleFontsStylesheets } from './doc-fonts.config.js';
import { DOC_PAPER_DIMENSIONS, DocProject } from './doc.types.js';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function sanitizeFilename(name: string): string {
  return (name || 'documento')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 100);
}

function htmlToMarkdown(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  temp.querySelectorAll('h1').forEach((el) => {
    el.outerHTML = `\n# ${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('h2').forEach((el) => {
    el.outerHTML = `\n## ${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('h3').forEach((el) => {
    el.outerHTML = `\n### ${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('h4').forEach((el) => {
    el.outerHTML = `\n#### ${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('blockquote').forEach((el) => {
    el.outerHTML = `\n> ${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('pre, code').forEach((el) => {
    el.outerHTML = `\n\`\`\`\n${el.textContent || ''}\n\`\`\`\n`;
  });
  temp.querySelectorAll('strong, b').forEach((el) => {
    el.outerHTML = `**${el.textContent || ''}**`;
  });
  temp.querySelectorAll('em, i').forEach((el) => {
    el.outerHTML = `*${el.textContent || ''}*`;
  });
  temp.querySelectorAll('u').forEach((el) => {
    el.outerHTML = `<u>${el.textContent || ''}</u>`;
  });
  temp.querySelectorAll('s, strike, del').forEach((el) => {
    el.outerHTML = `~~${el.textContent || ''}~~`;
  });
  temp.querySelectorAll('a').forEach((el) => {
    const href = el.getAttribute('href') || '#';
    el.outerHTML = `[${el.textContent || href}](${href})`;
  });
  temp.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') || 'imagen';
    el.outerHTML = `![${alt}](${src})\n`;
  });
  temp.querySelectorAll('li').forEach((el) => {
    el.outerHTML = `- ${el.textContent?.trim() || ''}\n`;
  });
  temp.querySelectorAll('p').forEach((el) => {
    el.outerHTML = `${el.textContent?.trim() || ''}\n\n`;
  });
  temp.querySelectorAll('br').forEach((el) => {
    el.outerHTML = '\n';
  });
  temp.querySelectorAll('hr').forEach((el) => {
    el.outerHTML = '\n---\n\n';
  });

  return (temp.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function exportDocPdf(project: DocProject, title: string): void {
  const paper = (DOC_PAPER_DIMENSIONS[project.settings.paperSize || 'letter'] && DOC_PAPER_DIMENSIONS[project.settings.paperSize || 'letter'][project.settings.orientation || 'portrait']) || DOC_PAPER_DIMENSIONS.letter.portrait;
  const margins = project.settings.margins || { bottom: 96, left: 96, right: 96, top: 96 };
  const isAuto = paper.widthMm === 0 || paper.heightMm === 0;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const watermarkHtml = project.settings.watermark?.enabled ? `
    <div class="print-watermark">
      ${project.settings.watermark.type === 'image' && project.settings.watermark.imageUrl
        ? `<img src="${project.settings.watermark.imageUrl}" alt="Watermark" />`
        : `<span>${project.settings.watermark.text || 'CONFIDENCIAL'}</span>`
      }
    </div>
  ` : '';

  const pagesHtml = project.pages.map((page, index) => {
    const pageNum = index + 1;
    const totalPages = project.pages.length;
    const isFirstPage = index === 0;
    const hideHeaderFooter = isFirstPage && project.settings.firstPageDifferent;

    let headerContent = '';
    if (!hideHeaderFooter) {
      const headerLogo = project.settings.headerLogoUrl ? `<img class="print-logo" src="${project.settings.headerLogoUrl}" alt="Logo" />` : '';
      const headerText = project.settings.headerText ? `<span>${project.settings.headerText}</span>` : '<span></span>';
      headerContent = project.settings.headerLogoPosition === 'right'
        ? `<div class="print-header">${headerText}${headerLogo}</div>`
        : `<div class="print-header">${headerLogo}${headerText}</div>`;
    }

    let footerContent = '';
    if (!hideHeaderFooter) {
      const footerLogo = project.settings.footerLogoUrl ? `<img class="print-logo" src="${project.settings.footerLogoUrl}" alt="Logo" />` : '';
      const pageNumberStr = project.settings.showPageNumbers
        ? `Página ${pageNum} de ${totalPages}`
        : (project.settings.footerText || '');
      footerContent = project.settings.footerLogoPosition === 'left'
        ? `<div class="print-footer">${footerLogo}<span>${pageNumberStr}</span></div>`
        : `<div class="print-footer"><span>${pageNumberStr}</span>${footerLogo}</div>`;
    }

    return `
      <div class="print-page ${project.settings.pageColor ? `print-theme-${project.settings.pageColor}` : ''} ${project.settings.pageBorder ? `print-border-${project.settings.pageBorder}` : ''}">
        ${watermarkHtml}
        ${headerContent}
        <div class="print-page-content ${project.settings.columnsCount === 2 ? 'print-cols-2' : (project.settings.columnsCount === 3 ? 'print-cols-3' : '')}">
          ${page.contentHtml}
        </div>
        ${footerContent}
      </div>
    `;
  }).join('');

  const docTitle = sanitizeFilename(title || 'Documento');
  const fontLinks = getLoadedGoogleFontsStylesheets()
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n  ');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${docTitle}</title>
      ${fontLinks}
      <style>
        @page {
          size: ${isAuto ? 'auto' : `${paper.widthMm}mm ${paper.heightMm}mm`};
          margin: ${isAuto ? '15mm' : '0'};
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: ${project.settings.fontFamily || 'Inter, system-ui, sans-serif'};
          font-size: ${project.settings.fontSize || 11}pt;
          line-height: ${project.settings.lineHeight || 1.5};
          color: #0f172a;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-page {
          width: ${isAuto ? '100%' : `${paper.widthMm}mm`};
          min-height: ${isAuto ? 'auto' : `${paper.heightMm}mm`};
          height: ${isAuto ? 'auto' : `${paper.heightMm}mm`};
          padding-top: ${margins.top * 0.264583}mm;
          padding-bottom: ${margins.bottom * 0.264583}mm;
          padding-left: ${margins.left * 0.264583}mm;
          padding-right: ${margins.right * 0.264583}mm;
          position: relative;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
          background: #ffffff;
        }
        .print-theme-cream { background: #fdfbf7 !important; }
        .print-theme-sepia { background: #fbf7ee !important; }
        .print-theme-editorial { background: #f8fafc !important; }
        .print-border-thin { border: 1.5px solid #cbd5e1; }
        .print-border-double { border: 3px double #94a3b8; }
        .print-border-dashed { border: 1.5px dashed #cbd5e1; }

        .print-page:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
        .print-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 56pt;
          font-weight: 800;
          color: rgba(148, 163, 184, 0.14);
          text-transform: uppercase;
          letter-spacing: 10px;
          user-select: none;
          pointer-events: none;
          white-space: nowrap;
          z-index: 1;
          text-align: center;
        }
        .print-watermark img {
          max-width: 280px;
          max-height: 280px;
          opacity: 0.12;
          filter: grayscale(100%);
        }
        .print-header {
          position: absolute;
          top: 8mm;
          left: ${margins.left * 0.264583}mm;
          right: ${margins.right * 0.264583}mm;
          font-size: 8.5pt;
          color: #94a3b8;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }
        .print-footer {
          position: absolute;
          bottom: 8mm;
          left: ${margins.left * 0.264583}mm;
          right: ${margins.right * 0.264583}mm;
          font-size: 8.5pt;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #e2e8f0;
          padding-top: 4px;
          z-index: 2;
        }
        .print-logo {
          max-height: 20px;
          max-width: 100px;
          object-fit: contain;
        }
        .print-page-content {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
        }
        .print-cols-2 {
          column-count: 2;
          column-gap: 20px;
          column-rule: 1px solid #e2e8f0;
        }
        .print-cols-3 {
          column-count: 3;
          column-gap: 16px;
          column-rule: 1px solid #e2e8f0;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        .doc-image-wrapper {
          display: inline-block;
          max-width: 100%;
        }
        .doc-img-wrap--left { float: left; margin: 4px 16px 8px 0; }
        .doc-img-wrap--right { float: right; margin: 4px 0 8px 16px; }
        .doc-img-wrap--center { display: block; margin: 12px auto; clear: both; }
        .doc-img-wrap--free { position: absolute; z-index: 10; }
        .doc-img-radius--8 { border-radius: 8px; }
        .doc-img-radius--18 { border-radius: 18px; }
        .doc-img-radius--pill { border-radius: 9999px; }
        .doc-image-caption { font-size: 8.5pt; color: #64748b; text-align: center; margin-top: 4px; font-style: italic; }
        .doc-title { font-size: 26pt; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; }
        .doc-subtitle { font-size: 14pt; font-weight: 500; color: #64748b; margin: 0 0 16px 0; }
        h1 { font-size: 20pt; font-weight: 700; margin: 1em 0 0.4em 0; color: #0f172a; }
        h2 { font-size: 16pt; font-weight: 700; margin: 0.9em 0 0.3em 0; color: #1e293b; }
        h3 { font-size: 13pt; font-weight: 600; margin: 0.7em 0 0.2em 0; color: #334155; }
        h4 { font-size: 11.5pt; font-weight: 600; margin: 0.5em 0 0.2em 0; color: #475569; }
        h5 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; margin: 0.4em 0 0.2em 0; color: #475569; }
        h6 { font-size: 9.5pt; font-weight: 600; color: #64748b; margin: 0.3em 0 0.1em 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
        }
        table td, table th {
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
        }
        table th { background: #f8fafc; font-weight: 600; }
        blockquote {
          border-left: 3px solid #3b82f6;
          margin: 1em 0;
          padding: 6px 12px;
          background: #f8fafc;
          font-style: italic;
        }
        pre {
          background: #0f172a;
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 9pt;
        }
        p { margin: 0 0 0.75em 0; }
      </style>
    </head>
    <body>
      ${pagesHtml}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export function exportDocWord(project: DocProject, title: string): void {
  const docTitle = sanitizeFilename(title || 'Documento');
  const watermarkText = project.settings.watermark?.enabled && project.settings.watermark.text ? project.settings.watermark.text : '';

  const bodyContent = project.pages.map((p, i) => `
    <div class="WordSection${i + 1}">
      ${watermarkText ? `<div style="text-align:center; color:#e2e8f0; font-size:36pt; font-weight:bold; margin-bottom:20px;">${watermarkText}</div>` : ''}
      ${p.contentHtml}
    </div>
    ${i < project.pages.length - 1 ? '<br clear="all" style="page-break-before:always" />' : ''}
  `).join('');

  const fontLinks = getLoadedGoogleFontsStylesheets()
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n  ');

  const wordHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      ${fontLinks}
      <style>
        body {
          font-family: ${project.settings.fontFamily || 'Calibri, Arial, sans-serif'};
          font-size: ${project.settings.fontSize || 11}pt;
          line-height: ${project.settings.lineHeight || 1.5};
          color: #0f172a;
        }
        .doc-title { font-size: 26pt; font-weight: bold; color: #0f172a; margin-bottom: 6pt; }
        .doc-subtitle { font-size: 14pt; color: #64748b; margin-bottom: 12pt; }
        h1 { font-size: 20pt; font-weight: bold; color: #0f172a; margin-top: 16pt; margin-bottom: 4pt; }
        h2 { font-size: 16pt; font-weight: bold; color: #1e293b; margin-top: 14pt; margin-bottom: 4pt; }
        h3 { font-size: 13pt; font-weight: bold; color: #334155; margin-top: 12pt; margin-bottom: 3pt; }
        h4 { font-size: 11.5pt; font-weight: bold; color: #475569; margin-top: 10pt; margin-bottom: 2pt; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        td, th { border: 1px solid #cbd5e1; padding: 6pt 10pt; }
        th { background-color: #f1f5f9; font-weight: bold; }
        blockquote { border-left: 3pt solid #3b82f6; margin: 10pt 0; padding: 4pt 12pt; font-style: italic; background: #f8fafc; }
        img { max-width: 100%; height: auto; }
        .doc-img-wrap--left { float: left; margin-right: 14pt; margin-bottom: 8pt; }
        .doc-img-wrap--right { float: right; margin-left: 14pt; margin-bottom: 8pt; }
        .doc-img-wrap--center { text-align: center; margin: 12pt 0; }
      </style>
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
  downloadBlob(blob, `${docTitle}.doc`);
}

export function exportDocMarkdown(project: DocProject, title: string): void {
  const docTitle = sanitizeFilename(title || 'Documento');
  const markdownPages = project.pages.map((p, i) => {
    const md = htmlToMarkdown(p.contentHtml);
    return i === 0 ? md : `\n\n---\n\n${md}`;
  }).join('');

  const blob = new Blob([markdownPages], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${docTitle}.md`);
}

export function exportDocTxt(project: DocProject, title: string): void {
  const docTitle = sanitizeFilename(title || 'Documento');
  const textPages = project.pages.map((p, i) => {
    const temp = document.createElement('div');
    temp.innerHTML = p.contentHtml;
    const text = temp.textContent || temp.innerText || '';
    return i === 0 ? text : `\n\n=== Página ${i + 1} ===\n\n${text}`;
  }).join('');

  const blob = new Blob([textPages], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${docTitle}.txt`);
}

export function exportDocHtml(project: DocProject, title: string): void {
  const docTitle = sanitizeFilename(title || 'Documento');
  const watermarkText = project.settings.watermark?.enabled && project.settings.watermark.text ? project.settings.watermark.text : '';
  const bodyContent = project.pages.map((p) => `<div class="doc-page-content">${p.contentHtml}</div>`).join('<hr style="margin: 40px 0; border: none; border-top: 1px dashed #cbd5e1;" />');
  const fontLinks = getLoadedGoogleFontsStylesheets()
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n  ');

  const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  ${fontLinks}
  <style>
    body {
      max-width: 820px;
      margin: 40px auto;
      padding: 0 24px;
      font-family: ${project.settings.fontFamily || 'Inter, system-ui, sans-serif'};
      font-size: ${project.settings.fontSize || 11}pt;
      line-height: ${project.settings.lineHeight || 1.5};
      color: #0f172a;
      background: #ffffff;
    }
    .watermark-banner { text-align: center; color: #cbd5e1; font-size: 28pt; font-weight: 800; letter-spacing: 8px; margin-bottom: 24px; }
    .doc-title { font-size: 28pt; font-weight: 800; color: #0f172a; margin: 0.5em 0 0.2em 0; }
    .doc-subtitle { font-size: 15pt; font-weight: 500; color: #64748b; margin: 0 0 1em 0; }
    h1 { font-size: 22pt; font-weight: 700; color: #0f172a; }
    h2 { font-size: 17pt; font-weight: 700; color: #1e293b; }
    h3 { font-size: 14pt; font-weight: 600; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td, th { border: 1px solid #cbd5e1; padding: 8px 12px; }
    th { background: #f8fafc; }
    img { max-width: 100%; height: auto; }
    .doc-img-wrap--left { float: left; margin: 6px 20px 14px 0; }
    .doc-img-wrap--right { float: right; margin: 6px 0 14px 20px; }
    .doc-img-wrap--center { display: block; margin: 16px auto; }
    blockquote { border-left: 4px solid #3b82f6; margin: 1.2em 0; padding: 8px 16px; background: #f8fafc; font-style: italic; }
  </style>
</head>
<body>
  ${watermarkText ? `<div class="watermark-banner">${watermarkText}</div>` : ''}
  ${bodyContent}
</body>
</html>
  `.trim();

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${docTitle}.html`);
}

export function exportDocJson(project: DocProject, title: string): void {
  const docTitle = sanitizeFilename(title || 'Documento');
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${docTitle}.json`);
}

export function generateDocThumbnail(project: DocProject): string {
  const canvas = document.createElement('canvas');
  const width = 320;
  const height = 180;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  const sheetW = 100;
  const sheetH = 140;
  const sheetX = (width - sheetW) / 2;
  const sheetY = (height - sheetH) / 2;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sheetX, sheetY, sheetW, sheetH);
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(sheetX, sheetY, sheetW, sheetH);

  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(sheetX + 10, sheetY + 12, 14, 14);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(sheetX + 28, sheetY + 14, sheetW - 38, 4);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(sheetX + 28, sheetY + 21, sheetW - 48, 2.5);

  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(sheetX + 10, sheetY + 32);
  ctx.lineTo(sheetX + sheetW - 10, sheetY + 32);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  const lineYStart = sheetY + 40;
  for (let i = 0; i < 7; i++) {
    const y = lineYStart + i * 8;
    const lw = i % 3 === 2 ? sheetW - 35 : (i % 2 === 1 ? sheetW - 24 : sheetW - 20);
    ctx.fillRect(sheetX + 10, y, lw, 3);
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(sheetX + 10, sheetY + 100, sheetW - 20, 24);

  return canvas.toDataURL('image/png');
}
