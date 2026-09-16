import { AdItem } from '../types/ad.types.js';

export const DEFAULT_AD_FREQUENCY = 8;

export const MOCK_ADS: AdItem[] = [
  {
    badgeText: 'AD',
    description: 'Crea, colabora e innova con las herramientas de productividad en la nube de Google.',
    id: 'google-workspace',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    sponsorName: 'Google Workspace',
    targetUrl: 'https://workspace.google.com/',
    title: 'Google Workspace: Trabaja de forma inteligente',
  },
  {
    badgeText: 'AD',
    description: 'Escala tus proyectos e infraestructura en la nube más rápida y segura.',
    id: 'google-cloud',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    sponsorName: 'Google Cloud',
    targetUrl: 'https://cloud.google.com/',
    title: 'Google Cloud: Construye el futuro hoy',
  },
  {
    badgeText: 'AD',
    description: 'Accede a documentación, APIs y recursos para desarrolladores modernos.',
    id: 'google-developers',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80',
    sponsorName: 'Google Developers',
    targetUrl: 'https://developers.google.com/',
    title: 'Google Developers: Recursos y APIs',
  },
  {
    badgeText: 'AD',
    description: 'Descubre tipografías e iconos de código abierto para tus proyectos visuales.',
    id: 'google-fonts',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80',
    sponsorName: 'Google Fonts',
    targetUrl: 'https://fonts.google.com/',
    title: 'Google Fonts: Tipografía e iconos abiertos',
  },
];