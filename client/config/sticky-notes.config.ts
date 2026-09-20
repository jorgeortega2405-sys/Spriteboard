export interface StickyNotePreset {
  color: string;
  id: string;
  name: string;
  stroke: string;
  textColor: string;
}

export const STICKY_NOTE_PRESETS: StickyNotePreset[] = [
  { color: '#fef08a', id: 'sticky_yellow', name: 'Amarillo', stroke: '#fde047', textColor: '#1e293b' },
  { color: '#fed7aa', id: 'sticky_orange', name: 'Naranja', stroke: '#fdba74', textColor: '#1e293b' },
  { color: '#fbcfe8', id: 'sticky_pink', name: 'Rosa', stroke: '#f472b6', textColor: '#1e293b' },
  { color: '#bae6fd', id: 'sticky_blue', name: 'Azul', stroke: '#7dd3fc', textColor: '#1e293b' },
  { color: '#bbf7d0', id: 'sticky_green', name: 'Verde', stroke: '#86efac', textColor: '#1e293b' },
  { color: '#e9d5ff', id: 'sticky_purple', name: 'Morado', stroke: '#d8b4fe', textColor: '#1e293b' },
  { color: '#fecaca', id: 'sticky_red', name: 'Rojo', stroke: '#fca5a5', textColor: '#1e293b' },
  { color: '#f1f5f9', id: 'sticky_gray', name: 'Gris', stroke: '#e2e8f0', textColor: '#1e293b' },
];

export const DEFAULT_STICKY_COLOR = '#fef08a';
