import { MockupCategory, MockupTemplate } from '../types/mockups.types.js';

export const DEFAULT_MOCKUP_PLACEHOLDER_SVG: string = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%237bc9ff"/>
      <stop offset="60%" stop-color="%23b8e4ff"/>
      <stop offset="100%" stop-color="%23dff2fe"/>
    </linearGradient>
    <linearGradient id="hillBack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%237db828"/>
      <stop offset="100%" stop-color="%23568812"/>
    </linearGradient>
    <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%2393c834"/>
      <stop offset="100%" stop-color="%23679c16"/>
    </linearGradient>
    <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="%23000000" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="600" height="600" fill="url(%23skyGrad)"/>
  <g filter="url(%23cloudShadow)">
    <path d="M260 210 A 32 32 0 0 1 310 185 A 46 46 0 0 1 385 200 A 30 30 0 0 1 410 230 A 28 28 0 0 1 390 265 L 240 265 A 25 25 0 0 1 230 220 A 30 30 0 0 1 260 210 Z" fill="%23ffffff" opacity="0.95"/>
  </g>
  <path d="M-50 650 L-50 420 Q 150 320 380 440 T 650 380 L650 650 Z" fill="url(%23hillBack)"/>
  <path d="M-50 650 L-50 480 Q 200 370 450 490 T 650 450 L650 650 Z" fill="url(%23hillFront)"/>
</svg>`;

export const MOCKUP_CATEGORIES: Array<{ icon: string; id: MockupCategory; name: string }> = [
  { icon: 'smartphone', id: 'smartphones', name: 'Smartphones' },
  { icon: 'laptop_mac', id: 'computers', name: 'Computadoras' },
  { icon: 'checkroom', id: 'apparel', name: 'Vestuario' },
  { icon: 'print', id: 'print', name: 'Imprimir' },
  { icon: 'cottage', id: 'home', name: 'Vida en el hogar' },
];

export const MOCKUP_TEMPLATES: MockupTemplate[] = [
  {
    aspectRatio: 9 / 19.5,
    category: 'smartphones',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Smartphone moderno sin marcos con isla de cámara y acabado metálico.',
    fitModeDefault: 'fill',
    height: 700,
    id: 'phone-modern-front',
    isPopular: true,
    name: 'Smartphone Frontal',
    printableBounds: { height: 656, width: 304, x: 18, y: 22 },
    roundedRadius: 36,
    thumbnailSvg: `<svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="10" width="84" height="160" rx="16" fill="#1e293b" stroke="#64748b" stroke-width="2"/><rect x="22" y="14" width="76" height="152" rx="12" fill="#7bc9ff"/><path d="M22 130 Q50 110 98 125 L98 166 L22 166 Z" fill="#679c16"/><rect x="48" y="18" width="24" height="6" rx="3" fill="#0f172a"/></svg>`,
    type: 'flat_mask',
    width: 340,
  },
  {
    aspectRatio: 9 / 19.5,
    category: 'smartphones',
    curveIntensity: 0,
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Smartphone sostenido en mano con perspectiva 3D realista.',
    fitModeDefault: 'fill',
    height: 600,
    id: 'phone-hand-perspective',
    isPopular: true,
    name: 'Smartphone en Mano',
    quadCorners: {
      bl: { x: 260, y: 480 },
      br: { x: 420, y: 430 },
      tl: { x: 300, y: 130 },
      tr: { x: 440, y: 110 },
    },
    roundedRadius: 18,
    thumbnailSvg: `<svg viewBox="0 0 180 140" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L180 0 L180 140 L0 140 Z" fill="#cbd5e1"/><polygon points="70,25 125,20 120,115 65,125" fill="#1e293b"/><polygon points="72,28 123,23 118,112 67,122" fill="#7bc9ff"/><path d="M30 140 Q 60 70 90 90 Q 110 100 120 140 Z" fill="#e2e8f0" opacity="0.8"/></svg>`,
    type: 'perspective_quad',
    width: 700,
  },
  {
    aspectRatio: 9 / 19.5,
    category: 'smartphones',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Smartphone flotante en ángulo isométrico con reflejo sutil.',
    fitModeDefault: 'fill',
    height: 650,
    id: 'phone-angled-isometric',
    name: 'Smartphone en Ángulo',
    quadCorners: {
      bl: { x: 140, y: 560 },
      br: { x: 340, y: 490 },
      tl: { x: 200, y: 110 },
      tr: { x: 390, y: 70 },
    },
    roundedRadius: 22,
    thumbnailSvg: `<svg viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg"><polygon points="45,28 105,15 90,155 32,165" fill="#334155"/><polygon points="48,32 102,20 87,150 35,160" fill="#7bc9ff"/><path d="M35 125 Q70 105 87 120 L87 150 L35 160 Z" fill="#679c16"/></svg>`,
    type: 'perspective_quad',
    width: 500,
  },
  {
    aspectRatio: 16 / 10,
    category: 'computers',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Laptop moderna de aluminio con pantalla brillante y teclado.',
    fitModeDefault: 'fill',
    height: 520,
    id: 'laptop-modern-front',
    isPopular: true,
    name: 'Laptop Frontal',
    printableBounds: { height: 350, width: 560, x: 120, y: 45 },
    roundedRadius: 10,
    thumbnailSvg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="15" width="140" height="90" rx="8" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/><rect x="36" y="20" width="128" height="78" rx="4" fill="#7bc9ff"/><path d="M36 70 Q90 50 164 65 L164 98 L36 98 Z" fill="#679c16"/><path d="M10 105 L190 105 L175 120 L25 120 Z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5"/></svg>`,
    type: 'flat_mask',
    width: 800,
  },
  {
    aspectRatio: 16 / 10,
    category: 'computers',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Laptop abierta sobre escritorio en perspectiva lateral.',
    fitModeDefault: 'fill',
    height: 550,
    id: 'laptop-desk-perspective',
    name: 'Laptop en Escritorio',
    quadCorners: {
      bl: { x: 195, y: 395 },
      br: { x: 615, y: 390 },
      tl: { x: 235, y: 95 },
      tr: { x: 575, y: 90 },
    },
    roundedRadius: 8,
    thumbnailSvg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L200 0 L200 140 L0 140 Z" fill="#e2e8f0"/><polygon points="45,25 155,20 165,95 35,100" fill="#1e293b"/><polygon points="48,28 152,23 162,92 38,97" fill="#7bc9ff"/><polygon points="15,102 185,96 170,128 30,132" fill="#cbd5e1"/></svg>`,
    type: 'perspective_quad',
    width: 800,
  },
  {
    aspectRatio: 16 / 9,
    category: 'computers',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Monitor de escritorio ultra-delgado con soporte minimalista.',
    fitModeDefault: 'fill',
    height: 560,
    id: 'desktop-monitor-studio',
    name: 'Monitor de Escritorio',
    printableBounds: { height: 380, width: 680, x: 40, y: 30 },
    roundedRadius: 8,
    thumbnailSvg: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="10" width="170" height="100" rx="6" fill="#0f172a" stroke="#475569" stroke-width="2"/><rect x="20" y="15" width="160" height="90" rx="3" fill="#7bc9ff"/><path d="M90 110 L110 110 L115 135 L85 135 Z" fill="#94a3b8"/><rect x="70" y="135" width="60" height="6" rx="2" fill="#64748b"/></svg>`,
    type: 'flat_mask',
    width: 760,
  },
  {
    aspectRatio: 1,
    category: 'apparel',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Camiseta blanca clásica con textura de tela y pliegues naturales.',
    fitModeDefault: 'fit',
    height: 650,
    id: 'tshirt-white-flat',
    isPopular: true,
    name: 'Camiseta Blanca Plana',
    printableBounds: { height: 340, width: 280, x: 185, y: 175 },
    roundedRadius: 0,
    thumbnailSvg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><path d="M50 20 L20 50 L40 65 L45 45 L45 140 L115 140 L115 45 L120 65 L140 50 L110 20 Q80 35 50 20 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><rect x="55" y="55" width="50" height="60" fill="#7bc9ff"/><path d="M55 95 Q80 85 105 92 L105 115 L55 115 Z" fill="#679c16"/></svg>`,
    type: 'flat_mask',
    width: 650,
  },
  {
    aspectRatio: 1,
    category: 'apparel',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Modelo vistiendo camiseta blanca con sombras corporales realistas.',
    fitModeDefault: 'fit',
    height: 700,
    id: 'tshirt-model-male',
    name: 'Modelo con Camiseta',
    printableBounds: { height: 300, width: 240, x: 230, y: 240 },
    roundedRadius: 2,
    thumbnailSvg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L160 0 L160 160 L0 160 Z" fill="#f1f5f9"/><circle cx="80" cy="30" r="18" fill="#e2e8f0"/><path d="M40 70 L25 95 L40 105 L45 90 L45 160 L115 160 L115 90 L120 105 L135 95 L120 70 Q80 80 40 70 Z" fill="#ffffff" stroke="#cbd5e1"/><rect x="60" y="90" width="40" height="50" fill="#7bc9ff"/></svg>`,
    type: 'flat_mask',
    width: 700,
  },
  {
    aspectRatio: 1,
    category: 'apparel',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Sudadera hoodie con capucha y bolsillo canguro.',
    fitModeDefault: 'fit',
    height: 650,
    id: 'hoodie-streetwear-flat',
    name: 'Sudadera Hoodie',
    printableBounds: { height: 260, width: 280, x: 185, y: 190 },
    roundedRadius: 0,
    thumbnailSvg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><path d="M50 25 Q80 5 110 25 L145 60 L130 75 L115 55 L115 145 L45 145 L45 55 L30 75 L15 60 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/><rect x="55" y="65" width="50" height="45" fill="#7bc9ff"/></svg>`,
    type: 'flat_mask',
    width: 650,
  },
  {
    aspectRatio: 1,
    category: 'print',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Fotografía estilo Polaroid vintage con cinta adhesiva superior y marco blanco.',
    fitModeDefault: 'fill',
    height: 600,
    id: 'print-polaroid-tape',
    isPopular: true,
    name: 'Foto Polaroid con Cinta',
    printableBounds: { height: 380, width: 420, x: 40, y: 70 },
    roundedRadius: 4,
    thumbnailSvg: `<svg viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="25" width="124" height="145" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><rect x="28" y="38" width="104" height="95" fill="#7bc9ff"/><path d="M28 95 Q60 80 132 90 L132 133 L28 133 Z" fill="#679c16"/><rect x="62" y="15" width="36" height="18" rx="2" fill="#fef08a" opacity="0.85" transform="rotate(-3 80 24)"/></svg>`,
    type: 'flat_mask',
    width: 500,
  },
  {
    aspectRatio: 1,
    category: 'print',
    curveIntensity: 0.15,
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Sticker adhesivo circular con esquina despegada en 3D.',
    fitModeDefault: 'fill',
    height: 500,
    id: 'print-sticker-peeled',
    isPopular: true,
    name: 'Sticker Circular Curvado',
    printableBounds: { height: 420, width: 420, x: 40, y: 40 },
    roundedRadius: 210,
    thumbnailSvg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><circle cx="80" cy="80" r="65" fill="#7bc9ff"/><path d="M15 80 Q80 40 145 80 A65 65 0 0 1 80 145 A65 65 0 0 1 15 80 Z" fill="#679c16"/><path d="M125 125 L95 145 Q125 125 145 95 Z" fill="#e2e8f0" stroke="#94a3b8"/><path d="M95 145 A65 65 0 0 0 145 95 L115 115 Z" fill="#cbd5e1"/></svg>`,
    type: 'flat_mask',
    width: 500,
  },
  {
    aspectRatio: 3 / 4,
    category: 'print',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Cartel póster tamaño A3 sostenido con ambas manos.',
    fitModeDefault: 'fill',
    height: 650,
    id: 'print-poster-hands',
    name: 'Póster en Manos',
    printableBounds: { height: 490, width: 350, x: 75, y: 70 },
    roundedRadius: 4,
    thumbnailSvg: `<svg viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L160 0 L160 180 L0 180 Z" fill="#fce7f3"/><rect x="35" y="25" width="90" height="120" rx="3" fill="#ffffff" stroke="#cbd5e1"/><rect x="40" y="30" width="80" height="110" fill="#7bc9ff"/><circle cx="28" cy="90" r="14" fill="#fbcfe8"/><circle cx="132" cy="90" r="14" fill="#fbcfe8"/></svg>`,
    type: 'flat_mask',
    width: 500,
  },
  {
    aspectRatio: 1,
    category: 'home',
    curveIntensity: 0.25,
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Taza de cerámica blanca con asa y curvatura cilíndrica fotorrealista.',
    fitModeDefault: 'fill',
    height: 500,
    id: 'home-mug-ceramic',
    isPopular: true,
    name: 'Taza de Cerámica Blanca',
    printableBounds: { height: 320, width: 330, x: 60, y: 90 },
    roundedRadius: 12,
    thumbnailSvg: `<svg viewBox="0 0 180 160" xmlns="http://www.w3.org/2000/svg"><path d="M125 45 C155 45 160 105 125 110" fill="none" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/><rect x="30" y="30" width="100" height="100" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><rect x="35" y="38" width="90" height="84" rx="6" fill="#7bc9ff"/><path d="M35 85 Q80 70 125 80 L125 122 L35 122 Z" fill="#679c16"/></svg>`,
    type: 'cylindrical_curve',
    width: 580,
  },
  {
    aspectRatio: 1,
    category: 'home',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Cojín cuadrado sobre sofá con costuras y sombras acolchadas.',
    fitModeDefault: 'fill',
    height: 550,
    id: 'home-cushion-pillow',
    name: 'Cojín de Sofá',
    printableBounds: { height: 360, width: 360, x: 95, y: 95 },
    roundedRadius: 32,
    thumbnailSvg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L160 0 L160 160 L0 160 Z" fill="#f8fafc"/><rect x="30" y="30" width="100" height="100" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><rect x="42" y="42" width="76" height="76" rx="16" fill="#7bc9ff"/></svg>`,
    type: 'flat_mask',
    width: 550,
  },
  {
    aspectRatio: 3 / 4,
    category: 'home',
    defaultPlaceholder: DEFAULT_MOCKUP_PLACEHOLDER_SVG,
    description: 'Bolsa tote bag de tela ecológica colgada del hombro.',
    fitModeDefault: 'fit',
    height: 650,
    id: 'home-totebag-canvas',
    name: 'Bolsa Tote Bag',
    printableBounds: { height: 320, width: 280, x: 110, y: 220 },
    roundedRadius: 8,
    thumbnailSvg: `<svg viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg"><path d="M55 60 C55 10 105 10 105 60" fill="none" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round"/><rect x="35" y="60" width="90" height="105" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><rect x="50" y="80" width="60" height="65" fill="#7bc9ff"/></svg>`,
    type: 'flat_mask',
    width: 500,
  },
];

export function getMockupTemplateById(id: string): MockupTemplate | undefined {
  return MOCKUP_TEMPLATES.find((tpl) => tpl.id === id);
}

export function getMockupsByCategory(category: MockupCategory): MockupTemplate[] {
  return MOCKUP_TEMPLATES.filter((tpl) => tpl.category === category);
}
