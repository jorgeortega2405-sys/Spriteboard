import { AppCategory, AppCategoryItem, SpriteboardApp } from '../types/apps.types.js';

export const APP_CATEGORIES: AppCategoryItem[] = [
  {
    icon: 'apps',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#6366f1"/><rect x="6" y="6" width="8" height="8" rx="2.5" fill="#ffffff"/><rect x="18" y="6" width="8" height="8" rx="2.5" fill="#ffffff"/><rect x="6" y="18" width="8" height="8" rx="2.5" fill="#ffffff"/><rect x="18" y="18" width="8" height="8" rx="2.5" fill="#ffffff"/></svg>`,
    id: 'all',
    i18nKey: 'your_apps.badge_all',
    name: 'Todas',
  },
  {
    icon: 'star',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#06b6d4"/><path d="M16 5L19.5 12.5L27 13.5L21.5 19L23 27L16 23L9 27L10.5 19L5 13.5L12.5 12.5L16 5Z" fill="#ffffff"/></svg>`,
    id: 'internal',
    i18nKey: 'your_apps.badge_internal',
    name: 'De Spriteboard',
  },
  {
    icon: 'work',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#10b981"/><path d="M22 10H10C8.895 10 8 10.895 8 12V22C8 23.105 8.895 24 10 24H22C23.105 24 24 23.105 24 22V12C24 10.895 23.105 10 22 10ZM13 8H19C19.552 8 20 8.448 20 9V10H12V9C12 8.448 12.448 8 13 8ZM22 22H10V14H22V22Z" fill="#ffffff"/></svg>`,
    id: 'productivity',
    i18nKey: 'your_apps.badge_productivity',
    name: 'Productividad',
  },
  {
    icon: 'smart_display',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#ef4444"/><polygon points="12,9 12,23 23,16" fill="#ffffff"/></svg>`,
    id: 'media',
    i18nKey: 'your_apps.badge_media',
    name: 'Multimedia',
  },
  {
    icon: 'photo_library',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#8b5cf6"/><path d="M7 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V9Z" fill="#ffffff" fill-opacity="0.2"/><path d="M10 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm1.5 11l2.5-3.5 1.5 2 3-4 3.5 5.5h-10.5ZM19 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="#ffffff"/></svg>`,
    id: 'photos',
    i18nKey: 'your_apps.badge_photos',
    name: 'Fotos',
  },
  {
    icon: 'build',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0ea5e9"/><path d="M22.7 19l-5.3-5.3c.7-1.4.5-3.2-.7-4.4-1.4-1.4-3.5-1.6-5.1-.7l3.1 3.1-2.1 2.1-3.1-3.1c-.9 1.6-.7 3.7.7 5.1 1.2 1.2 3 1.4 4.4.7l5.3 5.3c.4.4 1 .4 1.4 0l1.3-1.3c.4-.4.4-1.1 0-1.4z" fill="#ffffff"/></svg>`,
    id: 'utilities',
    i18nKey: 'your_apps.badge_utilities',
    name: 'Utilidades',
  },
];

export const SPRITEBOARD_APPS: SpriteboardApp[] = [
  {
    author: 'Spriteboard',
    badge: 'ACTIVA',
    bannerColor: '#0284c7',
    category: 'internal',
    categoryLabel: 'De Spriteboard',
    description: 'Genera códigos QR interactivos y personalizados para enlaces, textos y perfiles.',
    developer: 'Spriteboard Inc.',
    icon: 'qr_code',
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#0284c7"/><rect x="10" y="10" width="12" height="12" rx="3" fill="#ffffff"/><rect x="13" y="13" width="6" height="6" rx="1.5" fill="#0284c7"/><rect x="26" y="10" width="12" height="12" rx="3" fill="#ffffff"/><rect x="29" y="13" width="6" height="6" rx="1.5" fill="#0284c7"/><rect x="10" y="26" width="12" height="12" rx="3" fill="#ffffff"/><rect x="13" y="29" width="6" height="6" rx="1.5" fill="#0284c7"/><rect x="26" y="26" width="5" height="5" rx="1" fill="#ffffff"/><rect x="33" y="26" width="5" height="5" rx="1" fill="#ffffff"/><rect x="26" y="33" width="5" height="5" rx="1" fill="#ffffff"/><rect x="33" y="33" width="5" height="5" rx="1" fill="#ffffff"/></svg>`,
    id: 'qr-code',
    isInternal: true,
    isPopular: true,
    longDescription: 'Genera códigos QR dinámicos para enlaces web, redes sociales, Wi-Fi o datos de contacto. Personaliza los colores de fondo y patrón para que se adapten a tu marca e insértalos directamente en tus lienzos.',
    name: 'Código QR',
    permissions: [
      'Leer y modificar el contenido del diseño',
      'Insertar gráficos vectoriales de códigos QR en el lienzo',
      'Personalizar colores y resolución de exportación',
    ],
    status: 'active',
    subCategory: 'utilities',
    supportEmail: 'support@spriteboard.com',
    tagline: 'Agrega un código QR interactivo y personalizado a tu diseño de Spriteboard en segundos.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#ef4444',
    category: 'media',
    categoryLabel: 'Multimedia',
    description: 'Busca, inserta y reproduce videos de YouTube directamente dentro de tu diseño.',
    developer: 'Google LLC',
    icon: 'smart_display',
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#ef4444"/><path d="M35 17C36.5 17.5 37.5 18.5 38 20C38.8 22.5 38.8 24 38.8 24C38.8 24 38.8 25.5 38 28C37.5 29.5 36.5 30.5 35 31C32.5 31.8 24 31.8 24 31.8C24 31.8 15.5 31.8 13 31C11.5 30.5 10.5 29.5 10 28C9.2 25.5 9.2 24 9.2 24C9.2 24 9.2 22.5 10 20C10.5 18.5 11.5 17.5 13 17C15.5 16.2 24 16.2 24 16.2C24 16.2 32.5 16.2 35 17Z" fill="#ffffff"/><polygon points="21,20 21,28 28,24" fill="#ef4444"/></svg>`,
    id: 'youtube',
    isInternal: false,
    isPopular: true,
    longDescription: 'Busca en el catálogo global de YouTube e inserta videos directamente en tus tableros, documentos y presentaciones. Incluye previsualización interactiva y reproducción de alta calidad.',
    name: 'YouTube',
    permissions: [
      'Buscar videos públicos a través de la API oficial de YouTube',
      'Insertar reproductores y miniaturas de video en el diseño',
      'Reproducir contenido audiovisual durante presentaciones',
    ],
    status: 'active',
    subCategory: 'media',
    supportEmail: 'developer-support@google.com',
    tagline: 'Agrega e incrusta videos de YouTube a tu diseño de Spriteboard en segundos.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#0ea5e9',
    category: 'productivity',
    categoryLabel: 'Productividad',
    description: 'Importa tus fotos, documentos e ilustraciones desde Google Drive a tu espacio de trabajo.',
    developer: 'Google LLC',
    icon: 'add_to_drive',
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#0284c7"/><path d="M17 33L10 21L18 8H29L22 20L17 33Z" fill="#22c55e"/><path d="M38 33H17L22 24H43L38 33Z" fill="#eab308"/><path d="M29 8L43 30L38 39L24 17L29 8Z" fill="#3b82f6"/></svg>`,
    id: 'google-drive',
    isInternal: false,
    isPopular: true,
    longDescription: 'Conecta tu cuenta de Google Drive para explorar y transferir tus imágenes, documentos y archivos de diseño directamente al espacio de trabajo sin salir de tu lienzo.',
    name: 'Google Drive',
    permissions: [
      'Leer y acceder a los archivos seleccionados en Google Drive',
      'Importar imágenes y archivos a tus proyectos de Spriteboard',
      'Conexión OAuth cifrada y protegida por Google',
    ],
    status: 'active',
    subCategory: 'productivity',
    supportEmail: 'developer-support@google.com',
    tagline: 'Importa tus fotos, documentos e ilustraciones desde Google Drive a Spriteboard en segundos.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#ea4335',
    category: 'photos',
    categoryLabel: 'Fotos',
    description: 'Explora tu biblioteca de fotos y álbumes de Google Fotos para agregarlos en alta resolución.',
    developer: 'Google LLC',
    icon: 'photo_library',
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M24 10C24 10 24 18 24 18H16C16 13.58 19.58 10 24 10Z" fill="#ea4335"/><path d="M38 24C38 24 30 24 30 24V16C34.42 16 38 19.58 38 24Z" fill="#fbbc05"/><path d="M24 38C24 38 24 30 24 30H32C32 34.42 28.42 38 24 38Z" fill="#34a853"/><path d="M10 24C10 24 18 24 18 24V32C13.58 32 10 28.42 10 24Z" fill="#4285f4"/></svg>`,
    id: 'google-photos',
    isInternal: false,
    isPopular: true,
    longDescription: 'Sincroniza tus álbumes y recuerdos fotográficos desde Google Fotos. Navega por tu biblioteca e inserta fotografías en alta definición en cualquier lienzo de Spriteboard.',
    name: 'Google Fotos',
    permissions: [
      'Acceso de lectura a álbumes y fotos seleccionados',
      'Carga de fotografías de alta resolución en el lienzo',
      'Autenticación segura mediante Google Identity Services',
    ],
    status: 'active',
    subCategory: 'photos',
    supportEmail: 'developer-support@google.com',
    tagline: 'Explora tu biblioteca de fotos y álbumes de Google Fotos para agregarlos en alta resolución.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#10b981',
    category: 'utilities',
    categoryLabel: 'Utilidades',
    description: 'Busca ubicaciones y genera mapas interactivos y satelitales personalizados para tus diseños.',
    developer: 'Google LLC',
    icon: 'location_on',
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#10b981"/><path d="M24 10C17.4 10 12 15.4 12 22C12 30.5 24 38 24 38C24 38 36 30.5 36 22C36 15.4 30.6 10 24 10ZM24 26.5C21.5 26.5 19.5 24.5 19.5 22C19.5 19.5 21.5 17.5 24 17.5C26.5 17.5 28.5 19.5 28.5 22C28.5 24.5 26.5 26.5 24 26.5Z" fill="#ffffff"/></svg>`,
    id: 'google-maps',
    isInternal: false,
    isPopular: true,
    longDescription: 'Incorpora mapas en tus diseños y descubre y comparte lugares increíbles. Busca direcciones de cualquier parte del mundo, personaliza el estilo (estándar, oscuro, plata) y agrega marcadores interactivos.',
    name: 'Google Maps',
    permissions: [
      'Búsqueda y geolocalización de lugares y direcciones',
      'Generar e insertar mapas estáticos de alta definición',
      'Personalizar temas visuales, zoom y marcadores en el mapa',
    ],
    status: 'active',
    subCategory: 'utilities',
    supportEmail: 'developer-support@google.com',
    tagline: 'Agrega un mapa de Google a tu diseño de Spriteboard en segundos.',
  },
];

export function getAppById(id: string): SpriteboardApp | undefined {
  return SPRITEBOARD_APPS.find((app) => app.id === id);
}

export function getAppsByCategory(category: AppCategory): SpriteboardApp[] {
  if (category === 'all') return SPRITEBOARD_APPS;
  return SPRITEBOARD_APPS.filter((app) => app.category === category || app.subCategory === category);
}

export function searchApps(query: string, category: AppCategory = 'all'): SpriteboardApp[] {
  const cleanQ = query.trim().toLowerCase();
  let list = SPRITEBOARD_APPS;
  if (category !== 'all') {
    list = list.filter((app) => app.category === category || app.subCategory === category);
  }
  if (!cleanQ) return list;
  return list.filter((app) =>
    app.name.toLowerCase().includes(cleanQ) ||
    app.description.toLowerCase().includes(cleanQ) ||
    app.author.toLowerCase().includes(cleanQ) ||
    (app.categoryLabel && app.categoryLabel.toLowerCase().includes(cleanQ))
  );
}
