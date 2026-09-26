import { logger } from './logger.service.js';

export interface SanitizedSvgResult {
  buffer: Buffer;
  extension: 'svg';
  height: number | null;
  mimeType: 'image/svg+xml';
  size: number;
  svgString: string;
  width: number | null;
}

const DANGEROUS_TAGS = [
  'script',
  'foreignobject',
  'object',
  'embed',
  'applet',
  'iframe',
  'frame',
  'frameset',
  'meta',
  'link',
  'audio',
  'video',
  'input',
  'button',
  'form',
  'textarea',
  'select',
  'isindex',
  'base',
  'xml',
  'plaintext',
];

const DANGEROUS_SCHEMES = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:text/javascript',
  'data:application/javascript',
  'data:application/xhtml+xml',
];

export function sanitizeSvgContent(rawSvg: string): { height: number | null; sanitized: string; width: number | null } {
  if (!rawSvg || typeof rawSvg !== 'string') {
    throw new Error('El contenido SVG es inválido o está vacío.');
  }

  let cleaned = rawSvg.replace(/\0/g, '');

  cleaned = cleaned.replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '');
  cleaned = cleaned.replace(/<!DOCTYPE[\s\S]*?(?:\[[\s\S]*?\])?\s*>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  for (const tag of DANGEROUS_TAGS) {
    const tagRegex = new RegExp(`<\\s*${tag}[^>]*?>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi');
    cleaned = cleaned.replace(tagRegex, '');
    const selfClosingRegex = new RegExp(`<\\s*${tag}[^>]*?\\/?>`, 'gi');
    cleaned = cleaned.replace(selfClosingRegex, '');
  }

  cleaned = cleaned.replace(/\s+on[a-zA-Z0-9_\-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');

  cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi, (match, quote, val) => {
    const trimmed = val.replace(/[\s\r\n\t]/g, '').toLowerCase();
    for (const scheme of DANGEROUS_SCHEMES) {
      if (trimmed.startsWith(scheme)) {
        return '';
      }
    }
    return match;
  });

  cleaned = cleaned.replace(/\s+src\s*=\s*(["'])([\s\S]*?)\1/gi, (match, quote, val) => {
    const trimmed = val.replace(/[\s\r\n\t]/g, '').toLowerCase();
    for (const scheme of DANGEROUS_SCHEMES) {
      if (trimmed.startsWith(scheme)) {
        return '';
      }
    }
    return match;
  });

  cleaned = cleaned.replace(/<\s*style[^>]*?>([\s\S]*?)<\s*\/\s*style\s*>/gi, (_match, cssContent) => {
    let safeCss = cssContent;
    safeCss = safeCss.replace(/expression\s*\([^)]*\)/gi, '');
    safeCss = safeCss.replace(/behavior\s*:\s*[^;\}]+/gi, '');
    safeCss = safeCss.replace(/@import\s+[^;\}]+/gi, '');
    safeCss = safeCss.replace(/url\s*\(\s*(['"]?)\s*(?:javascript:|data:text\/html)[\s\S]*?\1\s*\)/gi, '');
    return `<style>${safeCss}</style>`;
  });

  cleaned = cleaned.replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (match, quote, styleContent) => {
    let safeStyle = styleContent;
    safeStyle = safeStyle.replace(/expression\s*\([^)]*\)/gi, '');
    safeStyle = safeStyle.replace(/behavior\s*:\s*[^;\}]+/gi, '');
    safeStyle = safeStyle.replace(/url\s*\(\s*(['"]?)\s*(?:javascript:|data:text\/html)[\s\S]*?\1\s*\)/gi, '');
    return ` style=${quote}${safeStyle}${quote}`;
  });

  const svgOpenMatch = cleaned.match(/<\s*svg\b([^>]*)>/i);
  if (!svgOpenMatch) {
    throw new Error('El archivo no contiene un elemento raíz <svg> válido.');
  }

  const svgAttributes = svgOpenMatch[1] || '';
  let width: number | null = null;
  let height: number | null = null;

  const widthMatch = svgAttributes.match(/\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)/i);
  const heightMatch = svgAttributes.match(/\bheight\s*=\s*["']?(\d+(?:\.\d+)?)/i);

  if (widthMatch) {
    width = parseFloat(widthMatch[1]);
  }
  if (heightMatch) {
    height = parseFloat(heightMatch[1]);
  }

  if ((!width || !height) && svgAttributes) {
    const viewBoxMatch = svgAttributes.match(/\bviewBox\s*=\s*["']?[^"']*?\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
    if (viewBoxMatch) {
      if (!width) width = parseFloat(viewBoxMatch[3]);
      if (!height) height = parseFloat(viewBoxMatch[4]);
    }
  }

  const svgStartIndex = cleaned.toLowerCase().indexOf('<svg');
  const svgEndIndex = cleaned.toLowerCase().lastIndexOf('</svg>');

  if (svgStartIndex === -1 || svgEndIndex === -1 || svgEndIndex < svgStartIndex) {
    throw new Error('La estructura interna del archivo SVG está incompleta o corrupta.');
  }

  const sanitized = cleaned.slice(svgStartIndex, svgEndIndex + 6).trim();

  return {
    height: height && !isNaN(height) ? Math.round(height) : null,
    sanitized,
    width: width && !isNaN(width) ? Math.round(width) : null,
  };
}

export function sanitizeSvg(input: Buffer | string): SanitizedSvgResult {
  const rawString = Buffer.isBuffer(input) ? input.toString('utf-8') : String(input);
  const { height, sanitized, width } = sanitizeSvgContent(rawString);
  const outputBuffer = Buffer.from(sanitized, 'utf-8');

  logger.security.info('Archivo SVG desinfectado y normalizado exitosamente', {
    height,
    size: outputBuffer.length,
    width,
  });

  return {
    buffer: outputBuffer,
    extension: 'svg',
    height,
    mimeType: 'image/svg+xml',
    size: outputBuffer.length,
    svgString: sanitized,
    width,
  };
}
