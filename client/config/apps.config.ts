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
    categoryLabel: 'De Spriteboard',
    description: 'Genera códigos QR interactivos y personalizados para enlaces, textos y perfiles.',
    developer: 'Spriteboard Inc.',
    icon: 'qr_code',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0284c7"/><rect x="14" y="14" width="16" height="16" rx="4" fill="#ffffff"/><rect x="18" y="18" width="8" height="8" rx="2" fill="#0284c7"/><rect x="34" y="14" width="16" height="16" rx="4" fill="#ffffff"/><rect x="38" y="18" width="8" height="8" rx="2" fill="#0284c7"/><rect x="14" y="34" width="16" height="16" rx="4" fill="#ffffff"/><rect x="18" y="38" width="8" height="8" rx="2" fill="#0284c7"/><rect x="34" y="34" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="44" y="34" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="34" y="44" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="44" y="44" width="6" height="6" rx="1.5" fill="#ffffff"/></svg>`,
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
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#ef4444"/><path d="M46 22C48 22.5 49.5 24 50 26C51 29.5 51 32 51 32C51 32 51 34.5 50 38C49.5 40 48 41.5 46 42C42.5 43 32 43 32 43C32 43 21.5 43 18 42C16 41.5 14.5 40 14 38C13 34.5 13 32 13 32C13 32 13 29.5 14 26C14.5 24 16 22.5 18 22C21.5 21 32 21 32 21C32 21 42.5 21 46 22Z" fill="#ffffff"/><polygon points="28,26 28,38 38,32" fill="#ef4444"/></svg>`,
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
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>`,
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
    supportEmail: 'developer-support@google.com',
    tagline: 'Importa tus fotos, documentos e ilustraciones desde Google Drive a Spriteboard en segundos.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#ea4335',
    category: 'media',
    categoryLabel: 'Multimedia',
    description: 'Explora tu biblioteca de fotos y álbumes de Google Fotos para agregarlos en alta resolución a tus proyectos.',
    developer: 'Google LLC',
    icon: 'photo_library',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>`,
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
    supportEmail: 'developer-support@google.com',
    tagline: 'Explora tu biblioteca de fotos y álbumes de Google Fotos para agregarlos en alta resolución.',
  },
  {
    author: 'Google LLC',
    badge: 'ACTIVA',
    bannerColor: '#10b981',
    category: 'utilities',
    categoryLabel: 'Visualización y Utilidades',
    description: 'Busca ubicaciones y genera mapas interactivos y satelitales personalizados para tus diseños.',
    developer: 'Google LLC',
    icon: 'location_on',
    iconSvg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#10b981"/><path d="M32 14C23.7 14 17 20.7 17 29C17 39.5 32 50 32 50C32 50 47 39.5 47 29C47 20.7 40.3 14 32 14ZM32 35C28.7 35 26 32.3 26 29C26 25.7 28.7 23 32 23C35.3 23 38 25.7 38 29C38 32.3 35.3 35 32 35Z" fill="#ffffff"/></svg>`,
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
    supportEmail: 'developer-support@google.com',
    tagline: 'Agrega un mapa de Google a tu diseño de Spriteboard en segundos.',
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
