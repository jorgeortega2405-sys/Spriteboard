export type DocPaperSize = 'a3' | 'a4' | 'a5' | 'digital' | 'legal' | 'letter' | 'tabloid';
export type DocOrientation = 'landscape' | 'portrait';
export type DocLineSpacing = 1.0 | 1.15 | 1.5 | 2.0;

export interface DocMargins {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface DocPageDimensions {
  heightMm: number;
  heightPx: number;
  name: string;
  widthMm: number;
  widthPx: number;
}

export const DOC_PAPER_DIMENSIONS: Record<string, { landscape: DocPageDimensions; portrait: DocPageDimensions }> = {
  digital: {
    landscape: { heightMm: 0, heightPx: 0, name: 'Digital (Horizontal)', widthMm: 0, widthPx: 1056 },
    portrait: { heightMm: 0, heightPx: 0, name: 'Digital (Automático)', widthMm: 0, widthPx: 816 },
  },
  a4: {
    landscape: { heightMm: 210, heightPx: 794, name: 'A4 (Horizontal)', widthMm: 297, widthPx: 1123 },
    portrait: { heightMm: 297, heightPx: 1123, name: 'A4 (21 × 29.7 cm)', widthMm: 210, widthPx: 794 },
  },
  a3: {
    landscape: { heightMm: 297, heightPx: 1123, name: 'A3 (Horizontal)', widthMm: 420, widthPx: 1587 },
    portrait: { heightMm: 420, heightPx: 1587, name: 'A3 (29.7 × 42 cm)', widthMm: 297, widthPx: 1123 },
  },
  letter: {
    landscape: { heightMm: 215.9, heightPx: 816, name: 'Carta (Horizontal)', widthMm: 279.4, widthPx: 1056 },
    portrait: { heightMm: 279.4, heightPx: 1056, name: 'Carta (8.5 × 11 in)', widthMm: 215.9, widthPx: 816 },
  },
  legal: {
    landscape: { heightMm: 215.9, heightPx: 816, name: 'Oficio (Horizontal)', widthMm: 355.6, widthPx: 1344 },
    portrait: { heightMm: 355.6, heightPx: 1344, name: 'Oficio (8.5 × 14 in)', widthMm: 215.9, widthPx: 816 },
  },
  a5: {
    landscape: { heightMm: 148, heightPx: 559, name: 'A5 (Horizontal)', widthMm: 210, widthPx: 794 },
    portrait: { heightMm: 210, heightPx: 794, name: 'A5', widthMm: 148, widthPx: 559 },
  },
  tabloid: {
    landscape: { heightMm: 279.4, heightPx: 1056, name: 'Tabloide (Horizontal)', widthMm: 431.8, widthPx: 1632 },
    portrait: { heightMm: 431.8, heightPx: 1632, name: 'Tabloide (11×17")', widthMm: 279.4, widthPx: 1056 },
  },
};

export const DOC_MARGIN_PRESETS: Record<string, { label: string; margins: DocMargins }> = {
  narrow: {
    label: 'Estrecho (1.27 cm)',
    margins: { bottom: 48, left: 48, right: 48, top: 48 },
  },
  normal: {
    label: 'Normal (2.54 cm)',
    margins: { bottom: 96, left: 96, right: 96, top: 96 },
  },
  wide: {
    label: 'Ancho (5.08 cm)',
    margins: { bottom: 96, left: 192, right: 192, top: 96 },
  },
};

export type DocPageColor = 'cream' | 'editorial' | 'sepia' | 'white';
export type DocPageBorder = 'dashed' | 'double' | 'none' | 'thin';
export type DocColumnsCount = 1 | 2 | 3;
export type DocImageWrapMode = 'center' | 'free' | 'inline' | 'left' | 'right';
export type DocImageShadow = 'lg' | 'md' | 'none' | 'sm';
export type DocImageRadius = '0' | '18' | '8' | 'pill';

export interface DocWatermark {
  color?: string;
  enabled: boolean;
  imageUrl?: string;
  opacity?: number;
  text?: string;
  type: 'image' | 'text';
}

export interface DocPage {
  contentHtml: string;
  footerHtml?: string;
  headerHtml?: string;
  id: string;
}

export interface DocSettings {
  columnsCount?: DocColumnsCount;
  firstPageDifferent?: boolean;
  fontFamily: string;
  fontSize: number;
  footerLogoPosition?: 'left' | 'right';
  footerLogoUrl?: string;
  footerText?: string;
  headerLogoPosition?: 'left' | 'right';
  headerLogoUrl?: string;
  headerText?: string;
  letterSpacing?: number;
  lineHeight: number;
  margins: DocMargins;
  orientation: DocOrientation;
  pageBorder?: DocPageBorder;
  pageColor?: DocPageColor | string;
  paperSize: DocPaperSize;
  paragraphSpacingAfter?: number;
  paragraphSpacingBefore?: number;
  showPageNumbers: boolean;
  viewMode: 'continuous' | 'paginated';
  watermark?: DocWatermark;
  zoom: number;
}

export interface DocProject {
  metadata?: {
    author?: string;
    created_at?: string;
    title?: string;
    updated_at?: string;
  };
  pages: DocPage[];
  settings: DocSettings;
  type: 'doc';
  version: number;
}

export interface DocStats {
  characters: number;
  charactersNoSpaces: number;
  pages: number;
  readingTimeMinutes: number;
  words: number;
}

export interface DocTemplatePreset {
  badge?: string;
  description: string;
  icon: string;
  id: string;
  initialPages: DocPage[];
  name: string;
  settings: Partial<DocSettings>;
}
