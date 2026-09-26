const DANGEROUS_TAGS = new Set([
  'applet',
  'audio',
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'frameset',
  'foreignobject',
  'iframe',
  'input',
  'isindex',
  'link',
  'meta',
  'object',
  'plaintext',
  'script',
  'select',
  'textarea',
  'video',
  'xml',
]);

const DANGEROUS_SCHEMES = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:text/javascript',
  'data:application/javascript',
  'data:application/xhtml+xml',
];

function sanitizeCssString(css: string): string {
  let cleaned = css;
  cleaned = cleaned.replace(/expression\s*\([^)]*\)/gi, '');
  cleaned = cleaned.replace(/behavior\s*:\s*[^;\}]+/gi, '');
  cleaned = cleaned.replace(/@import\s+[^;\}]+/gi, '');
  cleaned = cleaned.replace(/url\s*\(\s*(['"]?)\s*(?:javascript:|data:text\/html)[\s\S]*?\1\s*\)/gi, '');
  return cleaned;
}

function cleanElementNode(node: Element): void {
  const tagName = node.tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(tagName)) {
    node.remove();
    return;
  }

  const attributes = Array.from(node.attributes);
  for (const attr of attributes) {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value;

    if (attrName.startsWith('on')) {
      node.removeAttribute(attr.name);
      continue;
    }

    if (attrName === 'href' || attrName === 'xlink:href' || attrName === 'src' || attrName === 'action' || attrName === 'formaction') {
      const trimmed = attrValue.replace(/[\s\r\n\t]/g, '').toLowerCase();
      for (const scheme of DANGEROUS_SCHEMES) {
        if (trimmed.startsWith(scheme)) {
          node.removeAttribute(attr.name);
          break;
        }
      }
    }

    if (attrName === 'style') {
      const safeStyle = sanitizeCssString(attrValue);
      node.setAttribute('style', safeStyle);
    }
  }

  if (tagName === 'style') {
    node.textContent = sanitizeCssString(node.textContent || '');
  }

  const children = Array.from(node.children);
  for (const child of children) {
    cleanElementNode(child);
  }
}

export function sanitizeBrowserSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return '';
    }

    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
      return '';
    }

    cleanElementNode(svgElement);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  } catch {
    return '';
  }
}
