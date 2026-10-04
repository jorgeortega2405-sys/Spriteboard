export interface StickyNotePreset {
  color: string;
  foldColor: string;
  id: string;
  name: string;
  stroke: string;
  textColor: string;
}

export const STICKY_NOTE_PRESETS: StickyNotePreset[] = [
  { color: '#fccb07', foldColor: '#e59b00', id: 'sticky_yellow', name: 'Amarillo', stroke: '#f59e0b', textColor: '#202229' },
  { color: '#f9a850', foldColor: '#e07314', id: 'sticky_orange', name: 'Naranja', stroke: '#ea580c', textColor: '#202229' },
  { color: '#fc778c', foldColor: '#e11d48', id: 'sticky_pink', name: 'Rosa', stroke: '#f43f5e', textColor: '#202229' },
  { color: '#83bdfa', foldColor: '#2563eb', id: 'sticky_blue', name: 'Azul', stroke: '#3b82f6', textColor: '#202229' },
  { color: '#62d083', foldColor: '#059669', id: 'sticky_green', name: 'Verde', stroke: '#10b981', textColor: '#202229' },
  { color: '#c496fb', foldColor: '#7c3aed', id: 'sticky_purple', name: 'Morado', stroke: '#8b5cf6', textColor: '#202229' },
];

export const DEFAULT_STICKY_COLOR = '#fccb07';
export const DEFAULT_STICKY_TEXT_COLOR = '#202229';

export function getStickyNoteFoldColor(color: string): string {
  const normalized = color.toLowerCase();
  const preset = STICKY_NOTE_PRESETS.find((p) => p.color.toLowerCase() === normalized);
  if (preset) return preset.foldColor;
  return '#e59b00';
}

export function createStickyNoteSvg(color: string, foldColor?: string, size = 24): string {
  const actualFoldColor = foldColor || getStickyNoteFoldColor(color);
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M 6.5 2 H 17.5 A 4.5 4.5 0 0 1 22 6.5 V 14.5 L 14.5 22 H 6.5 A 4.5 4.5 0 0 1 2 17.5 V 6.5 A 4.5 4.5 0 0 1 6.5 2 Z" fill="${color}" /><path d="M 22 14.5 L 14.5 22 C 14.5 17.5 17.5 14.5 22 14.5 Z" fill="${actualFoldColor}" /></svg>`;
}

