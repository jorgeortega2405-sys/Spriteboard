import { AppCategory, AppCategoryItem, SpriteboardApp } from '../types/apps.types.js';

export const APP_CATEGORIES: AppCategoryItem[] = [
  { icon: 'apps', id: 'all', name: 'Todas' },
  { icon: 'star', id: 'internal', name: 'De Spriteboard' },
  { icon: 'smart_display', id: 'media', name: 'Multimedia' },
  { icon: 'work', id: 'productivity', name: 'Productividad' },
  { icon: 'build', id: 'utilities', name: 'Utilidades' },
];

export const SPRITEBOARD_APPS: SpriteboardApp[] = [
  {
    author: 'Spriteboard',
    badge: 'ACTIVA',
    bannerColor: '#0284c7',
    category: 'internal',
    description: 'Genera códigos QR interactivos y personalizados para enlaces, textos y perfiles.',
    icon: 'qr_code',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0284c7"/><rect x="14" y="14" width="16" height="16" rx="4" fill="#ffffff"/><rect x="18" y="18" width="8" height="8" rx="2" fill="#0284c7"/><rect x="34" y="14" width="16" height="16" rx="4" fill="#ffffff"/><rect x="38" y="18" width="8" height="8" rx="2" fill="#0284c7"/><rect x="14" y="34" width="16" height="16" rx="4" fill="#ffffff"/><rect x="18" y="38" width="8" height="8" rx="2" fill="#0284c7"/><rect x="34" y="34" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="44" y="34" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="34" y="44" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="44" y="44" width="6" height="6" rx="1.5" fill="#ffffff"/></svg>`,
    id: 'qr-code',
    isInternal: true,
    isPopular: true,
    name: 'Código QR',
    status: 'active',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#ef4444',
    category: 'media',
    description: 'Busca, inserta y reproduce videos de YouTube directamente dentro de tu diseño.',
    icon: 'smart_display',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#ef4444"/><path d="M46 22C48 22.5 49.5 24 50 26C51 29.5 51 32 51 32C51 32 51 34.5 50 38C49.5 40 48 41.5 46 42C42.5 43 32 43 32 43C32 43 21.5 43 18 42C16 41.5 14.5 40 14 38C13 34.5 13 32 13 32C13 32 13 29.5 14 26C14.5 24 16 22.5 18 22C21.5 21 32 21 32 21C32 21 42.5 21 46 22Z" fill="#ffffff"/><polygon points="28,26 28,38 38,32" fill="#ef4444"/></svg>`,
    id: 'youtube',
    isInternal: false,
    isPopular: true,
    name: 'YouTube',
    status: 'active',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#0ea5e9',
    category: 'productivity',
    description: 'Importa tus fotos, documentos e ilustraciones desde Google Drive a tu espacio de trabajo.',
    icon: 'add_to_drive',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>`,
    id: 'google-drive',
    isInternal: false,
    isPopular: true,
    name: 'Google Drive',
    status: 'active',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#ea4335',
    category: 'media',
    description: 'Explora tu biblioteca de fotos y álbumes de Google Fotos para agregarlos en alta resolución a tus proyectos.',
    icon: 'photo_library',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>`,
    id: 'google-photos',
    isInternal: false,
    isPopular: true,
    name: 'Google Fotos',
    status: 'active',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#10b981',
    category: 'utilities',
    description: 'Busca ubicaciones y genera mapas interactivos y satelitales personalizados para tus diseños.',
    icon: 'location_on',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#10b981"/><path d="M32 14C23.7 14 17 20.7 17 29C17 39.5 32 50 32 50C32 50 47 39.5 47 29C47 20.7 40.3 14 32 14ZM32 35C28.7 35 26 32.3 26 29C26 25.7 28.7 23 32 23C35.3 23 38 25.7 38 29C38 32.3 35.3 35 32 35Z" fill="#ffffff"/></svg>`,
    id: 'google-maps',
    isInternal: false,
    isPopular: true,
    name: 'Google Maps',
    status: 'active',
  },
];

export function getAppById(id: string): SpriteboardApp | undefined {
  return SPRITEBOARD_APPS.find((app) => app.id === id);
}

export function getAppsByCategory(category: AppCategory): SpriteboardApp[] {
  if (category === 'all') return SPRITEBOARD_APPS;
  return SPRITEBOARD_APPS.filter((app) => app.category === category);
}

export function searchApps(query: string, category: AppCategory = 'all'): SpriteboardApp[] {
  const cleanQ = query.trim().toLowerCase();
  let list = SPRITEBOARD_APPS;
  if (category !== 'all') {
    list = list.filter((app) => app.category === category);
  }
  if (!cleanQ) return list;
  return list.filter((app) =>
    app.name.toLowerCase().includes(cleanQ) ||
    app.description.toLowerCase().includes(cleanQ) ||
    app.author.toLowerCase().includes(cleanQ)
  );
}
