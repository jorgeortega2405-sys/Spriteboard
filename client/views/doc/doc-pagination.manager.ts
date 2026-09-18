import { DocPage, DocProject, DocStats } from './doc.types.js';

export class DocPaginationManager {
  public addPage(project: DocProject, afterIndex?: number): DocPage {
    const newPage: DocPage = {
      contentHtml: '<p><br></p>',
      id: `page_${crypto.randomUUID().slice(0, 8)}`,
    };

    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < project.pages.length) {
      project.pages.splice(afterIndex + 1, 0, newPage);
    } else {
      project.pages.push(newPage);
    }

    return newPage;
  }

  public calculateStats(project: DocProject): DocStats {
    let allText = '';
    for (const page of project.pages) {
      const temp = document.createElement('div');
      temp.innerHTML = page.contentHtml || '';
      allText += (temp.textContent || temp.innerText || '') + ' ';
    }

    const trimmed = allText.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const characters = trimmed.length;
    const charactersNoSpaces = trimmed.replace(/\s+/g, '').length;
    const pages = project.pages.length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    return {
      characters,
      charactersNoSpaces,
      pages,
      readingTimeMinutes,
      words,
    };
  }

  public deletePage(project: DocProject, pageId: string): boolean {
    if (project.pages.length <= 1) return false;
    const idx = project.pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return false;
    project.pages.splice(idx, 1);
    return true;
  }

  public formatHeaderFooter(template: string, pageNumber: number, totalPages: number, docTitle: string, author = ''): string {
    if (!template) return '';
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const yearStr = String(now.getFullYear());

    return template
      .replace(/\{page\}/gi, String(pageNumber))
      .replace(/\{total\}/gi, String(totalPages))
      .replace(/\{title\}/gi, docTitle || 'Documento')
      .replace(/\{date\}/gi, dateStr)
      .replace(/\{time\}/gi, timeStr)
      .replace(/\{year\}/gi, yearStr)
      .replace(/\{author\}/gi, author || 'Autor');
  }
}
