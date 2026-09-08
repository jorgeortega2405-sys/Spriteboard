import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from '../services/api.service.js';
import { saveLocalCanvas } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { getEmptyGraphicSvg, initCarouselScroll } from '../utils/dom.util.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

interface PresetVariant {
  label: string;
  width: number;
  height: number;
  imagePath?: string;
}

interface PresetItem {
  id: string;
  name: string;
  width: number;
  height: number;
  svgIcon?: string;
  imagePath?: string;
  isTemplate?: boolean;
  categoryName?: string;
  variants?: PresetVariant[];
}

interface PresetSection {
  id: string;
  titleKey: string;
  items: PresetItem[];
}

interface PresetCategoryTab {
  id: 'for-you' | 'formats' | 'nature' | 'cities' | 'fantasy' | 'scifi' | 'characters' | 'items';
  tabRef: string;
  titleKey: string;
  iconName: string;
  sections: PresetSection[];
}

function makeTemplateItem(
  id: string,
  name: string,
  category: string,
  fileBase: string,
  categoryLabel: string,
  isWide = false
): PresetItem {
  if (isWide) {
    return {
      id,
      name,
      width: 1920,
      height: 1080,
      imagePath: `/assets/templates/${category}/${fileBase}_1920x1080.png`,
      isTemplate: true,
      categoryName: categoryLabel,
      variants: [
        { label: '1920 × 1080 px', width: 1920, height: 1080, imagePath: `/assets/templates/${category}/${fileBase}_1920x1080.png` },
        { label: '1024 × 1024 px', width: 1024, height: 1024, imagePath: `/assets/templates/${category}/${fileBase}_1024x1024.png` },
        { label: '512 × 512 px', width: 512, height: 512, imagePath: `/assets/templates/${category}/${fileBase}_512x512.png` },
      ],
    };
  }

  return {
    id,
    name,
    width: 512,
    height: 512,
    imagePath: `/assets/templates/${category}/${fileBase}_512x512.png`,
    isTemplate: true,
    categoryName: categoryLabel,
    variants: [
      { label: '512 × 512 px', width: 512, height: 512, imagePath: `/assets/templates/${category}/${fileBase}_512x512.png` },
      { label: '768 × 768 px', width: 768, height: 768, imagePath: `/assets/templates/${category}/${fileBase}_768x768.png` },
      { label: '1024 × 1024 px', width: 1024, height: 1024, imagePath: `/assets/templates/${category}/${fileBase}_1024x1024.png` },
    ],
  };
}

const PRESET_SVGS: Record<string, string> = {
  formatSquareCharacter: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="31" y="8" width="58" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <path d="M31 14C31 10.6863 33.6863 8 37 8H83C86.3137 8 89 10.6863 89 14V22H31V14Z" fill="#3B82F6"/>
      <rect x="42" y="30" width="36" height="24" rx="4" fill="#EFF6FF"/>
      <rect x="46" y="35" width="16" height="4" rx="2" fill="#93C5FD"/>
      <rect x="46" y="42" width="28" height="3" rx="1.5" fill="#BFDBFE"/>
      <circle cx="72" cy="37" r="3" fill="#60A5FA"/>
    </svg>
  `,
  formatSquareBoss: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" y="8" width="64" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <path d="M28 14C28 10.6863 30.6863 8 34 8H86C89.3137 8 92 10.6863 92 14V22H28V14Z" fill="#7C3AED"/>
      <rect x="38" y="30" width="44" height="26" rx="4" fill="#F5F3FF"/>
      <circle cx="60" cy="40" r="7" fill="#A78BFA"/>
      <rect x="44" y="50" width="32" height="3" rx="1.5" fill="#DDD6FE"/>
    </svg>
  `,
  formatIconSmall: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="33" y="8" width="54" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="43" y="18" width="34" height="34" rx="6" fill="#FEF2F2"/>
      <rect x="52" y="27" width="16" height="16" rx="3" fill="#EF4444"/>
      <rect x="46" y="56" width="28" height="3" rx="1.5" fill="#E2E8F0"/>
    </svg>
  `,
  formatDialogueBox: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="11" width="84" height="53" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="24" y="18" width="22" height="22" rx="4" fill="#6366F1"/>
      <circle cx="35" cy="27" r="5" fill="#C7D2FE"/>
      <rect x="52" y="19" width="38" height="4" rx="2" fill="#94A3B8"/>
      <rect x="52" y="27" width="44" height="3" rx="1.5" fill="#CBD5E1"/>
      <rect x="52" y="34" width="30" height="3" rx="1.5" fill="#E2E8F0"/>
      <rect x="24" y="47" width="72" height="10" rx="3" fill="#F1F5F9"/>
    </svg>
  `,
  formatSquareGrid: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="31" y="8" width="58" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <path d="M31 14C31 10.6863 33.6863 8 37 8H83C86.3137 8 89 10.6863 89 14V20H31V14Z" fill="#10B981"/>
      <g transform="translate(37, 26)">
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#A7F3D0"/>
        <rect x="12" y="0" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="24" y="0" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="36" y="0" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="0" y="12" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="12" y="12" width="10" height="10" rx="2" fill="#34D399"/>
        <rect x="24" y="12" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="36" y="12" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="0" y="24" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="12" y="24" width="10" height="10" rx="2" fill="#F1F5F9"/>
        <rect x="24" y="24" width="10" height="10" rx="2" fill="#059669"/>
        <rect x="36" y="24" width="10" height="10" rx="2" fill="#F1F5F9"/>
      </g>
    </svg>
  `,
  formatIsometric: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" y="8" width="64" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <polygon points="60,18 84,29 60,40 36,29" fill="#38BDF8"/>
      <polygon points="36,29 60,40 60,56 36,45" fill="#0284C7"/>
      <polygon points="60,40 84,29 84,45 60,56" fill="#0369A1"/>
      <line x1="60" y1="40" x2="60" y2="56" stroke="#BAE6FD" stroke-width="1.2"/>
    </svg>
  `,
  formatStrip4f: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="18" width="98" height="39" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <line x1="35" y1="18" x2="35" y2="57" stroke="#E2E8F0" stroke-width="1.5"/>
      <line x1="60" y1="18" x2="60" y2="57" stroke="#E2E8F0" stroke-width="1.5"/>
      <line x1="84" y1="18" x2="84" y2="57" stroke="#E2E8F0" stroke-width="1.5"/>
      <circle cx="23" cy="42" r="5" fill="#3B82F6"/>
      <circle cx="47" cy="34" r="5" fill="#3B82F6"/>
      <circle cx="72" cy="38" r="5" fill="#3B82F6"/>
      <circle cx="96" cy="30" r="5" fill="#3B82F6"/>
    </svg>
  `,
  formatRetroGameboy: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="36" y="6" width="48" height="63" rx="6" fill="#E2E8F0" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="42" y="12" width="36" height="28" rx="3" fill="#8B956D"/>
      <rect x="47" y="17" width="12" height="12" rx="1" fill="#4B5320"/>
      <circle cx="49" cy="50" r="3.5" fill="#475569"/>
      <circle cx="70" cy="48" r="2.5" fill="#991B1B"/>
      <circle cx="76" cy="52" r="2.5" fill="#991B1B"/>
    </svg>
  `,
  formatRetroPico8: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="31" y="8" width="58" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="38" y="16" width="44" height="34" rx="4" fill="#000000"/>
      <circle cx="60" cy="31" r="7" fill="#FF004D"/>
      <circle cx="60" cy="31" r="3" fill="#FFEC27"/>
      <rect x="38" y="54" width="11" height="4" fill="#00E436"/>
      <rect x="49" y="54" width="11" height="4" fill="#29ADFF"/>
      <rect x="60" y="54" width="11" height="4" fill="#83769C"/>
      <rect x="71" y="54" width="11" height="4" fill="#FF77A8"/>
    </svg>
  `,
  formatRetroConsole: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="12" width="76" height="51" rx="8" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="22" y="12" width="76" height="14" rx="6" fill="#CBD5E1"/>
      <circle cx="36" cy="38" r="6" fill="#64748B"/>
      <circle cx="76" cy="33" r="3" fill="#3B82F6"/>
      <circle cx="83" cy="33" r="3" fill="#EAB308"/>
      <circle cx="76" cy="43" r="3" fill="#22C55E"/>
      <circle cx="83" cy="43" r="3" fill="#EF4444"/>
    </svg>
  `,
  formatLandscapeParallax: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="15" width="100" height="45" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="14" y="19" width="92" height="37" rx="4" fill="#F0F9FF"/>
      <path d="M14 42L36 29L58 45L78 33L106 52V56H14V42Z" fill="#BAE6FD"/>
      <path d="M14 47L40 37L66 49L88 41L106 54V56H14V47Z" fill="#38BDF8"/>
      <circle cx="88" cy="26" r="4" fill="#FDE047"/>
    </svg>
  `,
  formatVerticalMobile: `
    <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="42" y="5" width="36" height="65" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.25))"/>
      <rect x="46" y="10" width="28" height="48" rx="4" fill="#F8FAFC"/>
      <rect x="50" y="16" width="20" height="12" rx="2" fill="#E0E7FF"/>
      <circle cx="60" cy="63" r="2" fill="#94A3B8"/>
    </svg>
  `,
};

const CATEGORY_TABS: PresetCategoryTab[] = [
  {
    id: 'for-you',
    tabRef: 'tab-for-you',
    titleKey: 'canvas.tab_for_you',
    iconName: 'recommend',
    sections: [
      {
        id: 'most-used',
        titleKey: 'canvas.section_most_used',
        items: [
          { id: 'fmt-sprite-32', name: 'Sprite estándar', width: 32, height: 32, svgIcon: PRESET_SVGS.formatSquareCharacter },
          makeTemplateItem('tmpl-nat-forest', 'Bosque Mágico', 'nature', 'forest', 'Naturaleza', true),
          { id: 'fmt-gb-classic', name: 'Game Boy Clásica', width: 160, height: 144, svgIcon: PRESET_SVGS.formatRetroGameboy },
          makeTemplateItem('tmpl-ct-cyber', 'Callejón Cyberpunk', 'cities', 'cyber_alley', 'Ciudades'),
          { id: 'fmt-pico8', name: 'PICO-8 Fantasy', width: 128, height: 128, svgIcon: PRESET_SVGS.formatRetroPico8 },
          makeTemplateItem('tmpl-fn-dungeon', 'Mazmorra Oscura', 'fantasy', 'dark_dungeon', 'Fantasía'),
        ],
      },
      {
        id: 'popular',
        titleKey: 'canvas.section_popular',
        items: [
          makeTemplateItem('tmpl-sci-station', 'Estación Orbital', 'scifi', 'orbital_station', 'Espacio', true),
          makeTemplateItem('tmpl-ch-humanoid', 'Base Humanoide', 'characters', 'humanoid_base', 'Personajes'),
          makeTemplateItem('tmpl-it-sword', 'Espada de Cristal', 'items', 'crystal_sword', 'Objetos'),
          { id: 'fmt-snes', name: 'SNES 4:3', width: 256, height: 224, svgIcon: PRESET_SVGS.formatRetroConsole },
          makeTemplateItem('tmpl-it-potion', 'Poción de Maná', 'items', 'mana_potion', 'Objetos'),
          makeTemplateItem('tmpl-ch-chibi', 'Retrato Chibi', 'characters', 'chibi_portrait', 'Personajes'),
        ],
      },
      {
        id: 'try-new',
        titleKey: 'canvas.section_try_new',
        items: [
          makeTemplateItem('tmpl-nat-crystals', 'Cueva de Cristales', 'nature', 'crystal_cave', 'Naturaleza'),
          makeTemplateItem('tmpl-ct-metropolis', 'Metrópolis Nocturna', 'cities', 'night_metropolis', 'Ciudades', true),
          makeTemplateItem('tmpl-fn-portal', 'Portal Místico', 'fantasy', 'mystic_portal', 'Fantasía'),
          makeTemplateItem('tmpl-sci-planet', 'Planeta con Anillos', 'scifi', 'ringed_planet', 'Espacio'),
          makeTemplateItem('tmpl-ch-slime', 'Criatura Slime', 'characters', 'slime_creature', 'Personajes'),
          makeTemplateItem('tmpl-fn-chest', 'Cofre Legendario', 'fantasy', 'treasure_chest', 'Fantasía'),
        ],
      },
    ],
  },
  {
    id: 'formats',
    tabRef: 'tab-formats',
    titleKey: 'canvas.tab_formats',
    iconName: 'straighten',
    sections: [
      {
        id: 'fmt-sprites',
        titleKey: 'canvas.section_classic_sprites',
        items: [
          { id: 'fmt-sp-16', name: 'Micro Sprite 16×16', width: 16, height: 16, svgIcon: PRESET_SVGS.formatIconSmall },
          { id: 'fmt-sp-32', name: 'Sprite Estándar 32×32', width: 32, height: 32, svgIcon: PRESET_SVGS.formatSquareCharacter },
          { id: 'fmt-sp-48', name: 'Sprite Grande 48×48', width: 48, height: 48, svgIcon: PRESET_SVGS.formatSquareCharacter },
          { id: 'fmt-sp-64', name: 'Sprite Detallado 64×64', width: 64, height: 64, svgIcon: PRESET_SVGS.formatSquareBoss },
          { id: 'fmt-sp-128', name: 'Gran Lienzo 128×128', width: 128, height: 128, svgIcon: PRESET_SVGS.formatSquareBoss },
        ],
      },
      {
        id: 'fmt-retro',
        titleKey: 'canvas.section_retro_consoles',
        items: [
          { id: 'fmt-rc-gb', name: 'Game Boy (160×144)', width: 160, height: 144, svgIcon: PRESET_SVGS.formatRetroGameboy },
          { id: 'fmt-rc-nes', name: 'NES (256×240)', width: 256, height: 240, svgIcon: PRESET_SVGS.formatRetroConsole },
          { id: 'fmt-rc-snes', name: 'SNES (256×224)', width: 256, height: 224, svgIcon: PRESET_SVGS.formatRetroConsole },
          { id: 'fmt-rc-gba', name: 'GBA (240×160)', width: 240, height: 160, svgIcon: PRESET_SVGS.formatRetroConsole },
          { id: 'fmt-rc-genesis', name: 'Mega Drive (320×224)', width: 320, height: 224, svgIcon: PRESET_SVGS.formatRetroConsole },
          { id: 'fmt-rc-pico8', name: 'PICO-8 (128×128)', width: 128, height: 128, svgIcon: PRESET_SVGS.formatRetroPico8 },
        ],
      },
      {
        id: 'fmt-screens',
        titleKey: 'canvas.section_screens_parallax',
        items: [
          { id: 'fmt-sc-144p', name: 'Pixel 144p (256×144)', width: 256, height: 144, svgIcon: PRESET_SVGS.formatLandscapeParallax },
          { id: 'fmt-sc-180p', name: 'Pixel 180p (320×180)', width: 320, height: 180, svgIcon: PRESET_SVGS.formatLandscapeParallax },
          { id: 'fmt-sc-270p', name: 'Pixel 270p (480×270)', width: 480, height: 270, svgIcon: PRESET_SVGS.formatLandscapeParallax },
          { id: 'fmt-sc-360p', name: 'Pixel 360p (640×360)', width: 640, height: 360, svgIcon: PRESET_SVGS.formatLandscapeParallax },
          { id: 'fmt-sc-vertical', name: 'Pantalla vertical (64×128)', width: 64, height: 128, svgIcon: PRESET_SVGS.formatVerticalMobile },
        ],
      },
      {
        id: 'fmt-tilesets',
        titleKey: 'canvas.section_tilesets_maps',
        items: [
          { id: 'fmt-tl-16', name: 'Tileset 16×16 estándar', width: 256, height: 256, svgIcon: PRESET_SVGS.formatSquareGrid },
          { id: 'fmt-tl-32', name: 'Tileset 32×32 HD', width: 512, height: 512, svgIcon: PRESET_SVGS.formatSquareGrid },
          { id: 'fmt-tl-iso', name: 'Arte isométrico 2:1', width: 128, height: 128, svgIcon: PRESET_SVGS.formatIsometric },
          { id: 'fmt-tl-strip', name: 'Tira de 4 cuadros', width: 128, height: 32, svgIcon: PRESET_SVGS.formatStrip4f },
        ],
      },
    ],
  },
  {
    id: 'nature',
    tabRef: 'tab-nature',
    titleKey: 'canvas.tab_nature',
    iconName: 'eco',
    sections: [
      {
        id: 'nat-forests',
        titleKey: 'canvas.section_forests_islands',
        items: [
          makeTemplateItem('tmpl-nat-forest', 'Bosque de Pinos', 'nature', 'forest', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-beach', 'Playa Tropical', 'nature', 'beach', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-waterfall', 'Cascada Mística', 'nature', 'waterfall', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-swamp', 'Pantano Misterioso', 'nature', 'swamp', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-flower', 'Campo de Flores', 'nature', 'flower_field', 'Naturaleza', true),
        ],
      },
      {
        id: 'nat-mountains',
        titleKey: 'canvas.section_mountains_caves',
        items: [
          makeTemplateItem('tmpl-nat-mountain', 'Montaña Nevada', 'nature', 'mountain', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-desert', 'Desierto al Atardecer', 'nature', 'sunset_desert', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-crystals', 'Cueva de Cristales', 'nature', 'crystal_cave', 'Naturaleza'),
          makeTemplateItem('tmpl-nat-volcano', 'Volcán Ardiente', 'nature', 'volcano', 'Naturaleza', true),
          makeTemplateItem('tmpl-nat-coral', 'Arrecife de Coral', 'nature', 'coral_reef', 'Naturaleza', true),
        ],
      },
    ],
  },
  {
    id: 'cities',
    tabRef: 'tab-cities',
    titleKey: 'canvas.tab_cities',
    iconName: 'apartment',
    sections: [
      {
        id: 'ct-cyberpunk',
        titleKey: 'canvas.section_cyberpunk_neon',
        items: [
          makeTemplateItem('tmpl-ct-metropolis', 'Metrópolis Nocturna', 'cities', 'night_metropolis', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-cyber', 'Callejón Cyberpunk', 'cities', 'cyber_alley', 'Ciudades'),
          makeTemplateItem('tmpl-ct-tokyo', 'Calles de Tokio', 'cities', 'tokyo_street', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-rooftop', 'Techo Urbano', 'cities', 'city_rooftop', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-suburb', 'Suburbio Otoñal', 'cities', 'autumn_suburb', 'Ciudades', true),
        ],
      },
      {
        id: 'ct-urban',
        titleKey: 'canvas.section_urban_streets',
        items: [
          makeTemplateItem('tmpl-ct-medieval', 'Pueblo Medieval', 'cities', 'medieval_town', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-seaport', 'Puerto Marítimo', 'cities', 'seaport', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-castle', 'Castillo en la Colina', 'cities', 'hill_castle', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-train', 'Estación de Tren', 'cities', 'train_station', 'Ciudades', true),
          makeTemplateItem('tmpl-ct-market', 'Mercado Antiguo', 'cities', 'ancient_market', 'Ciudades', true),
        ],
      },
    ],
  },
  {
    id: 'fantasy',
    tabRef: 'tab-fantasy',
    titleKey: 'canvas.tab_fantasy',
    iconName: 'shield',
    sections: [
      {
        id: 'fn-dungeons',
        titleKey: 'canvas.section_dungeons_castles',
        items: [
          makeTemplateItem('tmpl-fn-dungeon', 'Mazmorra Oscura', 'fantasy', 'dark_dungeon', 'Fantasía'),
          makeTemplateItem('tmpl-fn-throne', 'Sala del Trono', 'fantasy', 'throne_room', 'Fantasía', true),
          makeTemplateItem('tmpl-fn-portal', 'Portal Místico', 'fantasy', 'mystic_portal', 'Fantasía'),
          makeTemplateItem('tmpl-fn-chest', 'Cofre Legendario', 'fantasy', 'treasure_chest', 'Fantasía'),
          makeTemplateItem('tmpl-fn-ruins', 'Ruinas Élficas', 'fantasy', 'elven_ruins', 'Fantasía', true),
        ],
      },
      {
        id: 'fn-taverns',
        titleKey: 'canvas.section_taverns_altars',
        items: [
          makeTemplateItem('tmpl-fn-potions', 'Tienda de Pociones', 'fantasy', 'potion_shop', 'Fantasía'),
          makeTemplateItem('tmpl-fn-forge', 'Forja Enana', 'fantasy', 'dwarven_forge', 'Fantasía'),
          makeTemplateItem('tmpl-fn-wizard', 'Torre del Mago', 'fantasy', 'wizard_tower', 'Fantasía'),
          makeTemplateItem('tmpl-fn-dragon', 'Puente del Dragón', 'fantasy', 'dragon_bridge', 'Fantasía', true),
          makeTemplateItem('tmpl-fn-altar', 'Altar Arcano', 'fantasy', 'arcane_altar', 'Fantasía'),
        ],
      },
    ],
  },
  {
    id: 'scifi',
    tabRef: 'tab-scifi',
    titleKey: 'canvas.tab_scifi',
    iconName: 'stars',
    sections: [
      {
        id: 'sci-cosmos',
        titleKey: 'canvas.section_galaxies_cosmos',
        items: [
          makeTemplateItem('tmpl-sci-station', 'Estación Orbital', 'scifi', 'orbital_station', 'Espacio', true),
          makeTemplateItem('tmpl-sci-nebula', 'Nebulosa Cósmica', 'scifi', 'cosmic_nebula', 'Espacio', true),
          makeTemplateItem('tmpl-sci-planet', 'Planeta con Anillos', 'scifi', 'ringed_planet', 'Espacio'),
          makeTemplateItem('tmpl-sci-lunar', 'Superficie Lunar', 'scifi', 'lunar_surface', 'Espacio', true),
          makeTemplateItem('tmpl-sci-cockpit', 'Cabina de Nave', 'scifi', 'cockpit', 'Espacio', true),
        ],
      },
      {
        id: 'sci-stations',
        titleKey: 'canvas.section_stations_hangars',
        items: [
          makeTemplateItem('tmpl-sci-asteroid', 'Asteroide Minero', 'scifi', 'mining_asteroid', 'Espacio'),
          makeTemplateItem('tmpl-sci-floating', 'Ciudad Flotante', 'scifi', 'floating_city', 'Espacio', true),
          makeTemplateItem('tmpl-sci-lab', 'Laboratorio Alienígena', 'scifi', 'alien_lab', 'Espacio'),
          makeTemplateItem('tmpl-sci-wormhole', 'Agujero de Gusano', 'scifi', 'wormhole', 'Espacio'),
          makeTemplateItem('tmpl-sci-satellite', 'Satélite Solar', 'scifi', 'solar_satellite', 'Espacio', true),
        ],
      },
    ],
  },
  {
    id: 'characters',
    tabRef: 'tab-characters',
    titleKey: 'canvas.tab_characters',
    iconName: 'person',
    sections: [
      {
        id: 'ch-mannequins',
        titleKey: 'canvas.section_mannequins_chibi',
        items: [
          makeTemplateItem('tmpl-ch-humanoid', 'Base Humanoide Frente', 'characters', 'humanoid_base', 'Personajes'),
          makeTemplateItem('tmpl-ch-warrior', 'Base Guerrero Perfil', 'characters', 'warrior_side', 'Personajes'),
          makeTemplateItem('tmpl-ch-mannequin-f', 'Maniquí Femenino', 'characters', 'mannequin_f', 'Personajes'),
          makeTemplateItem('tmpl-ch-mannequin-m', 'Maniquí Masculino', 'characters', 'mannequin_m', 'Personajes'),
          makeTemplateItem('tmpl-ch-spritesheet', 'Hoja 4 Direcciones', 'characters', 'sprite_sheet_4way', 'Personajes'),
        ],
      },
      {
        id: 'ch-portraits',
        titleKey: 'canvas.section_portraits_busts',
        items: [
          makeTemplateItem('tmpl-ch-chibi', 'Retrato Chibi', 'characters', 'chibi_portrait', 'Personajes'),
          makeTemplateItem('tmpl-ch-mage', 'Mago con Túnica', 'characters', 'mage_robe', 'Personajes'),
          makeTemplateItem('tmpl-ch-knight', 'Caballero con Armadura', 'characters', 'armored_knight', 'Personajes'),
          makeTemplateItem('tmpl-ch-slime', 'Criatura Slime', 'characters', 'slime_creature', 'Personajes'),
          makeTemplateItem('tmpl-ch-skull', 'Monstruo Calavera', 'characters', 'skull_monster', 'Personajes'),
        ],
      },
    ],
  },
  {
    id: 'items',
    tabRef: 'tab-items',
    titleKey: 'canvas.tab_items',
    iconName: 'category',
    sections: [
      {
        id: 'it-weapons',
        titleKey: 'canvas.section_weapons_equipment',
        items: [
          makeTemplateItem('tmpl-it-sword', 'Espada de Cristal', 'items', 'crystal_sword', 'Objetos'),
          makeTemplateItem('tmpl-it-shield', 'Escudo Heráldico', 'items', 'heraldic_shield', 'Objetos'),
          makeTemplateItem('tmpl-it-helmet', 'Casco de Guerrero', 'items', 'warrior_helmet', 'Objetos'),
          makeTemplateItem('tmpl-it-bow', 'Arco Élfico', 'items', 'elven_bow', 'Objetos'),
          makeTemplateItem('tmpl-it-gold', 'Lingote de Oro', 'items', 'gold_ingot', 'Objetos'),
        ],
      },
      {
        id: 'it-relics',
        titleKey: 'canvas.section_potions_relics',
        items: [
          makeTemplateItem('tmpl-it-potion', 'Poción de Maná', 'items', 'mana_potion', 'Objetos'),
          makeTemplateItem('tmpl-it-spellbook', 'Libro de Hechizos', 'items', 'spellbook', 'Objetos'),
          makeTemplateItem('tmpl-it-gem', 'Gema Preciosa', 'items', 'gemstone', 'Objetos'),
          makeTemplateItem('tmpl-it-key', 'Llave Dorada', 'items', 'golden_key', 'Objetos'),
          makeTemplateItem('tmpl-it-skull', 'Calavera de Cristal', 'items', 'crystal_skull', 'Objetos'),
        ],
      },
    ],
  },
];

const ALL_PRESETS_MAP = new Map<string, PresetItem>();
CATEGORY_TABS.forEach((cat) => {
  cat.sections.forEach((sec) => {
    sec.items.forEach((item) => {
      if (!ALL_PRESETS_MAP.has(item.id)) {
        ALL_PRESETS_MAP.set(item.id, item);
      }
    });
  });
});
const ALL_PRESETS = Array.from(ALL_PRESETS_MAP.values());

function buildPresetCardHtml(item: PresetItem): string {
  const badgeText = `${item.width} × ${item.height} px`;
  const previewContent = item.imagePath
    ? `<img class="canvas-card__image" data-ref="preset-card-img-${item.id}" src="${item.imagePath}" alt="${item.name}" loading="lazy" />`
    : (item.svgIcon || '');

  return `
    <div class="canvas-card" data-ref="preset-card-${item.id}" data-preset-id="${item.id}" data-width="${item.width}" data-height="${item.height}" data-name="${item.name}">
      <div class="canvas-card__preview" data-ref="preset-card-preview-${item.id}">
        ${previewContent}
      </div>
      <div class="canvas-card__badges-tl" data-ref="preset-card-badge-container-${item.id}">
        <div class="canvas-card__badge canvas-card__badge--glass" data-ref="preset-card-badge-${item.id}">
          <span>${badgeText}</span>
        </div>
      </div>
      <div class="canvas-card__bottom" data-ref="preset-card-bottom-${item.id}">
        <h3 class="canvas-card__title" data-ref="preset-card-title-${item.id}" title="${item.name}">
          ${item.name}
        </h3>
      </div>
    </div>
  `;
}

function buildCategorySectionHtml(catId: string, sec: PresetSection): string {
  const cardsHtml = sec.items.map(buildPresetCardHtml).join('');
  const uniqueSecId = `${catId}-${sec.id}`;

  return `
    <div class="preset-category" data-ref="preset-category-${uniqueSecId}">
      <h4 class="preset-category__title" data-ref="preset-title-${uniqueSecId}" data-i18n="${sec.titleKey}">
        ${t(sec.titleKey)}
      </h4>
      <div class="preset-category__carousel-container" data-ref="carousel-container-${uniqueSecId}">
        <button type="button" class="preset-carousel__nav-btn preset-carousel__nav-btn--left is-disabled" data-ref="btn-carousel-left-${uniqueSecId}" data-tooltip="Desplazar a la izquierda" aria-label="Desplazar a la izquierda">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
        </button>
        <div class="preset-category__track" data-ref="preset-track-${uniqueSecId}">
          ${cardsHtml}
        </div>
        <button type="button" class="preset-carousel__nav-btn preset-carousel__nav-btn--right" data-ref="btn-carousel-right-${uniqueSecId}" data-tooltip="Desplazar a la derecha" aria-label="Desplazar a la derecha">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
        </button>
      </div>
    </div>
  `;
}

function buildCategoryPanelHtml(cat: PresetCategoryTab): string {
  const sectionsHtml = cat.sections.map((sec) => buildCategorySectionHtml(cat.id, sec)).join('');
  return `
    <div class="modal-presets-category-panel" data-ref="panel-category-${cat.id}" style="${cat.id === 'for-you' ? 'display: flex;' : 'display: none;'}">
      ${sectionsHtml}
    </div>
  `;
}

export function openCreateCanvasModal(): void {
  if (activeCreateCanvasModal) {
    activeCreateCanvasModal.close();
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  const categoryPanelsHtml = CATEGORY_TABS.map(buildCategoryPanelHtml).join('');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-create-canvas-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-create-canvas">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-create-canvas-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-sidebar-top">
            <div class="component-top-left" data-ref="modal-sidebar-top-left">
              <h1 class="component-top-title" data-i18n="canvas.modal_title">${t('canvas.modal_title')}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-for-you">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#recommend"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_for_you">${t('canvas.tab_for_you')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-formats">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#straighten"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_formats">${t('canvas.tab_formats')}</span>
              </button>

              <div class="menu-divider" data-ref="modal-nav-divider-templates"></div>

              <button type="button" class="menu-item" data-ref="tab-nature">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#eco"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_nature">${t('canvas.tab_nature')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-cities">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#apartment"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_cities">${t('canvas.tab_cities')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-fantasy">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_fantasy">${t('canvas.tab_fantasy')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-scifi">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#stars"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_scifi">${t('canvas.tab_scifi')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-characters">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_characters">${t('canvas.tab_characters')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-items">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_items">${t('canvas.tab_items')}</span>
              </button>

              <div class="menu-divider" data-ref="modal-nav-divider-custom"></div>

              <button type="button" class="menu-item" data-ref="tab-custom-size">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#aspect_ratio"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_custom_size">${t('canvas.tab_custom_size')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-upload">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_upload">${t('canvas.tab_upload')}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-search component-search--full" data-ref="modal-search-box">
              <div class="component-search__icon" data-ref="modal-search-icon">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
              </div>
              <div class="component-search__input-box" data-ref="modal-search-input-box">
                <input class="component-search__input" data-ref="modal-search-input" data-i18n-placeholder="canvas.search_placeholder" type="text" maxlength="100" autocomplete="off" placeholder="${t('canvas.search_placeholder')}" />
              </div>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            ${categoryPanelsHtml}

            <div class="modal-search-results-container" data-ref="modal-search-results" style="display: none;">
              <h4 class="preset-category__title" data-i18n="canvas.search_results_title">${t('canvas.search_results_title')}</h4>
              <div class="modal-search-results-grid" data-ref="modal-search-results-grid"></div>
            </div>

            <div class="component-empty-state" data-ref="presets-empty-search" style="display: none;">
              <div class="component-empty-state-graphic" data-ref="modal-empty-search-graphic">
                ${getEmptyGraphicSvg('search')}
              </div>
              <h2 class="component-empty-state-title" data-i18n="canvas.home_search_no_results_title">${t('canvas.home_search_no_results_title')}</h2>
              <p class="component-empty-state-desc" data-i18n="canvas.search_no_results">${t('canvas.search_no_results')}</p>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-custom-size" style="display: none;">
              <div class="modal-canvas-panel__form" data-ref="form-custom-size">
                <div class="settings-group" data-ref="custom-size-group-template-banner" style="display: none;">
                  <div class="template-info-banner" data-ref="template-info-banner">
                    <div class="template-info-banner__left" data-ref="template-info-left">
                      <div class="template-info-banner__icon" data-ref="template-info-icon">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
                      </div>
                      <div class="template-info-banner__text" data-ref="template-info-text">
                        <span class="template-info-banner__title" data-ref="template-info-name">Plantilla</span>
                        <span class="template-info-banner__desc" data-i18n="canvas.template_locked_dims_desc">${t('canvas.template_locked_dims_desc')}</span>
                      </div>
                    </div>
                    <button type="button" class="template-info-banner__btn" data-ref="btn-clear-template" data-tooltip="${t('canvas.template_clear_tooltip')}" aria-label="${t('canvas.template_clear_tooltip')}">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
                    </button>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-variants" style="display: none;">
                  <div class="settings-item" data-ref="custom-size-item-variants">
                    <div class="settings-item__content" data-ref="custom-size-variants-content">
                      <div class="settings-item__text" data-ref="custom-size-variants-text">
                        <h2 class="settings-item__title" data-ref="custom-size-variants-title" data-i18n="canvas.template_variants_title">${t('canvas.template_variants_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-variants-desc" data-i18n="canvas.template_variants_desc">${t('canvas.template_variants_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-variants-actions">
                      <div class="template-variants-pills" data-ref="template-variants-pills"></div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-name">
                  <div class="settings-item" data-ref="custom-size-item-name">
                    <div class="settings-item__content" data-ref="custom-size-name-content">
                      <div class="settings-item__text" data-ref="custom-size-name-text">
                        <h2 class="settings-item__title" data-ref="custom-size-name-title" data-i18n="canvas.canvas_name_title">${t('canvas.canvas_name_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-name-desc" data-i18n="canvas.canvas_name_desc">${t('canvas.canvas_name_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-name-actions">
                      <input class="modal-canvas-panel__name-input" data-ref="input-canvas-name" type="text" placeholder="${t('canvas.input_name_placeholder')}" value="${t('canvas.input_name_placeholder')}" maxlength="100" autocomplete="off" />
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-width">
                  <div class="settings-item" data-ref="custom-size-item-width">
                    <div class="settings-item__content" data-ref="custom-size-width-content">
                      <div class="settings-item__text" data-ref="custom-size-width-text">
                        <h2 class="settings-item__title" data-ref="custom-size-width-title" data-i18n="canvas.canvas_width_title">${t('canvas.canvas_width_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-width-desc" data-i18n="canvas.canvas_width_desc">${t('canvas.canvas_width_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-width-actions">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-width">
                        <div class="component-inline-control__group" data-ref="inline-group-width-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-canvas-width" type="number" min="1" max="16384" value="64" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="inline-group-width-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-height">
                  <div class="settings-item" data-ref="custom-size-item-height">
                    <div class="settings-item__content" data-ref="custom-size-height-content">
                      <div class="settings-item__text" data-ref="custom-size-height-text">
                        <h2 class="settings-item__title" data-ref="custom-size-height-title" data-i18n="canvas.canvas_height_title">${t('canvas.canvas_height_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-height-desc" data-i18n="canvas.canvas_height_desc">${t('canvas.canvas_height_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-height-actions">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-height">
                        <div class="component-inline-control__group" data-ref="inline-group-height-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-canvas-height" type="number" min="1" max="16384" value="64" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="inline-group-height-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="modal-canvas-panel__actions" data-ref="custom-size-actions">
                  <button type="button" class="btn btn--h44 btn--black btn--w-full" data-ref="btn-submit-create-canvas">
                    ${t('canvas.btn_create')}
                  </button>
                  <div class="banner banner--danger" data-ref="create-canvas-error" style="display: none;"></div>
                </div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-upload" style="display: none;">
              <div class="component-empty-state" data-ref="panel-upload-empty">
                <div class="component-empty-state-graphic" data-ref="modal-upload-empty-graphic">
                  ${getEmptyGraphicSvg('upload')}
                </div>
                <h2 class="component-empty-state-title" data-i18n="canvas.upload_title">${t('canvas.upload_title')}</h2>
                <p class="component-empty-state-desc" data-i18n="canvas.upload_desc">${t('canvas.upload_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  translateElement(backdrop);
  renderIcons(backdrop);

  type TabType = 'for-you' | 'formats' | 'nature' | 'cities' | 'fantasy' | 'scifi' | 'characters' | 'items' | 'custom-size' | 'upload';

  const tabButtons = new Map<TabType, HTMLElement | null>([
    ['for-you', backdrop.querySelector<HTMLElement>('[data-ref="tab-for-you"]')],
    ['formats', backdrop.querySelector<HTMLElement>('[data-ref="tab-formats"]')],
    ['nature', backdrop.querySelector<HTMLElement>('[data-ref="tab-nature"]')],
    ['cities', backdrop.querySelector<HTMLElement>('[data-ref="tab-cities"]')],
    ['fantasy', backdrop.querySelector<HTMLElement>('[data-ref="tab-fantasy"]')],
    ['scifi', backdrop.querySelector<HTMLElement>('[data-ref="tab-scifi"]')],
    ['characters', backdrop.querySelector<HTMLElement>('[data-ref="tab-characters"]')],
    ['items', backdrop.querySelector<HTMLElement>('[data-ref="tab-items"]')],
    ['custom-size', backdrop.querySelector<HTMLElement>('[data-ref="tab-custom-size"]')],
    ['upload', backdrop.querySelector<HTMLElement>('[data-ref="tab-upload"]')],
  ]);

  const categoryPanels = new Map<string, HTMLElement | null>();
  CATEGORY_TABS.forEach((cat) => {
    categoryPanels.set(cat.id, backdrop.querySelector<HTMLElement>(`[data-ref="panel-category-${cat.id}"]`));
  });

  const panelCustomSize = backdrop.querySelector<HTMLElement>('[data-ref="panel-custom-size"]');
  const panelUpload = backdrop.querySelector<HTMLElement>('[data-ref="panel-upload"]');

  const searchInput = backdrop.querySelector<HTMLInputElement>('[data-ref="modal-search-input"]');
  const searchResultsContainer = backdrop.querySelector<HTMLElement>('[data-ref="modal-search-results"]');
  const searchResultsGrid = backdrop.querySelector<HTMLElement>('[data-ref="modal-search-results-grid"]');
  const presetsEmptySearch = backdrop.querySelector<HTMLElement>('[data-ref="presets-empty-search"]');

  const templateBannerGroup = backdrop.querySelector<HTMLElement>('[data-ref="custom-size-group-template-banner"]');
  const templateInfoName = backdrop.querySelector<HTMLElement>('[data-ref="template-info-name"]');
  const templateVariantsGroup = backdrop.querySelector<HTMLElement>('[data-ref="custom-size-group-variants"]');
  const templateVariantsPills = backdrop.querySelector<HTMLElement>('[data-ref="template-variants-pills"]');
  const btnClearTemplate = backdrop.querySelector<HTMLElement>('[data-ref="btn-clear-template"]');

  const carouselControllers: Array<{ catId: string; destroy: () => void; updateButtons: () => void }> = [];

  CATEGORY_TABS.forEach((cat) => {
    cat.sections.forEach((sec) => {
      const uniqueSecId = `${cat.id}-${sec.id}`;
      const wrapper = backdrop.querySelector<HTMLElement>(`[data-ref="carousel-container-${uniqueSecId}"]`);
      if (wrapper) {
        const ctrl = initCarouselScroll(wrapper, {
          carouselSelector: `[data-ref="preset-track-${uniqueSecId}"]`,
          leftBtnSelector: `[data-ref="btn-carousel-left-${uniqueSecId}"]`,
          rightBtnSelector: `[data-ref="btn-carousel-right-${uniqueSecId}"]`,
          step: 220,
        });
        if (ctrl) {
          carouselControllers.push({ catId: cat.id, destroy: ctrl.destroy, updateButtons: ctrl.updateButtons });
        }
      }
    });
  });

  let currentTab: TabType = 'for-you';
  let activeTemplate: PresetItem | null = null;
  let activeVariantIndex = 0;

  const updateCarouselsForCategory = (catId: string) => {
    requestAnimationFrame(() => {
      carouselControllers
        .filter((c) => c.catId === catId)
        .forEach((c) => c.updateButtons());
    });
  };

  const switchTab = (activeTab: TabType) => {
    currentTab = activeTab;

    tabButtons.forEach((btn, key) => {
      btn?.classList.toggle('is-active', key === activeTab);
    });

    categoryPanels.forEach((panel, catId) => {
      if (panel) {
        panel.style.display = activeTab === catId ? 'flex' : 'none';
      }
    });

    if (panelCustomSize) panelCustomSize.style.display = activeTab === 'custom-size' ? 'flex' : 'none';
    if (panelUpload) panelUpload.style.display = activeTab === 'upload' ? 'flex' : 'none';

    if (searchResultsContainer) searchResultsContainer.style.display = 'none';
    if (presetsEmptySearch) presetsEmptySearch.style.display = 'none';

    if (activeTab !== 'custom-size' && activeTab !== 'upload') {
      updateCarouselsForCategory(activeTab);
    }
  };

  tabButtons.forEach((btn, tabKey) => {
    btn?.addEventListener('click', () => {
      if (searchInput && searchInput.value.trim()) {
        searchInput.value = '';
      }
      switchTab(tabKey);
    });
  });

  const inputName = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-name"]');
  const inputWidth = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-width"]');
  const inputHeight = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-height"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-create-canvas"]');
  const errorBox = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');

  const btnWidthDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-dec-large"]');
  const btnWidthDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-dec"]');
  const btnWidthInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-inc"]');
  const btnWidthIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-inc-large"]');

  const btnHeightDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-dec-large"]');
  const btnHeightDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-dec"]');
  const btnHeightInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-inc"]');
  const btnHeightIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-inc-large"]');

  const stepperButtons = [
    btnWidthDecLarge as HTMLButtonElement | null,
    btnWidthDec as HTMLButtonElement | null,
    btnWidthInc as HTMLButtonElement | null,
    btnWidthIncLarge as HTMLButtonElement | null,
    btnHeightDecLarge as HTMLButtonElement | null,
    btnHeightDec as HTMLButtonElement | null,
    btnHeightInc as HTMLButtonElement | null,
    btnHeightIncLarge as HTMLButtonElement | null,
  ];

  const setDimensions = (w: number, h: number) => {
    if (inputWidth) {
      inputWidth.value = String(w);
      inputWidth.dispatchEvent(new Event('input', { bubbles: true }));
      inputWidth.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputHeight) {
      inputHeight.value = String(h);
      inputHeight.dispatchEvent(new Event('input', { bubbles: true }));
      inputHeight.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const clearActiveTemplate = () => {
    activeTemplate = null;
    activeVariantIndex = 0;
    if (templateBannerGroup) templateBannerGroup.style.display = 'none';
    if (templateVariantsGroup) templateVariantsGroup.style.display = 'none';
    if (templateVariantsPills) templateVariantsPills.innerHTML = '';
    if (inputWidth) inputWidth.readOnly = false;
    if (inputHeight) inputHeight.readOnly = false;
    stepperButtons.forEach((b) => {
      if (b) b.disabled = false;
    });
  };

  const renderVariantPills = (variants: PresetVariant[]) => {
    if (!templateVariantsPills) return;
    templateVariantsPills.innerHTML = variants
      .map(
        (v, idx) => `
        <button type="button" class="template-variant-pill ${idx === activeVariantIndex ? 'is-active' : ''}" data-ref="btn-variant-${idx}" data-variant-index="${idx}">
          ${v.label}
        </button>
      `
      )
      .join('');

    templateVariantsPills.querySelectorAll<HTMLElement>('.template-variant-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const idx = parseInt(pill.getAttribute('data-variant-index') || '0', 10);
        activeVariantIndex = idx;
        templateVariantsPills
          .querySelectorAll('.template-variant-pill')
          .forEach((p, i) => p.classList.toggle('is-active', i === idx));
        const chosen = variants[idx];
        if (chosen) {
          setDimensions(chosen.width, chosen.height);
        }
      });
    });
  };

  const applyTemplateOrFormat = (item: PresetItem) => {
    if (item.isTemplate && item.variants && item.variants.length > 0) {
      activeTemplate = item;
      activeVariantIndex = 0;

      if (templateBannerGroup) templateBannerGroup.style.display = 'block';
      if (templateInfoName) templateInfoName.textContent = item.name;
      if (templateVariantsGroup) templateVariantsGroup.style.display = 'block';

      renderVariantPills(item.variants);

      const initialVariant = item.variants[0];
      setDimensions(initialVariant.width, initialVariant.height);

      if (inputWidth) inputWidth.readOnly = true;
      if (inputHeight) inputHeight.readOnly = true;
      stepperButtons.forEach((b) => {
        if (b) b.disabled = true;
      });
    } else {
      clearActiveTemplate();
      setDimensions(item.width, item.height);
    }

    if (inputName) {
      inputName.value = item.name;
      inputName.dispatchEvent(new Event('input', { bubbles: true }));
      inputName.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (searchInput) searchInput.value = '';
    switchTab('custom-size');
    setTimeout(() => {
      inputName?.focus();
      inputName?.select();
    }, 80);
  };

  btnClearTemplate?.addEventListener('click', () => {
    clearActiveTemplate();
  });

  const setupNumberStepper = (
    inputEl: HTMLInputElement | null,
    btnDecLarge: HTMLElement | null,
    btnDec: HTMLElement | null,
    btnInc: HTMLElement | null,
    btnIncLarge: HTMLElement | null,
    minVal = 1,
    maxVal = 16384
  ) => {
    if (!inputEl) return;

    const adjust = (delta: number) => {
      if (activeTemplate) return;
      const current = parseInt(inputEl.value, 10) || minVal;
      const next = Math.max(minVal, Math.min(maxVal, current + delta));
      inputEl.value = String(next);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    };

    btnDecLarge?.addEventListener('click', () => adjust(-16));
    btnDec?.addEventListener('click', () => adjust(-1));
    btnInc?.addEventListener('click', () => adjust(1));
    btnIncLarge?.addEventListener('click', () => adjust(16));

    inputEl.addEventListener('change', () => {
      const val = parseInt(inputEl.value, 10);
      if (isNaN(val) || val < minVal) {
        inputEl.value = String(minVal);
      } else if (val > maxVal) {
        inputEl.value = String(maxVal);
      }
    });
  };

  setupNumberStepper(inputWidth, btnWidthDecLarge, btnWidthDec, btnWidthInc, btnWidthIncLarge);
  setupNumberStepper(inputHeight, btnHeightDecLarge, btnHeightDec, btnHeightInc, btnHeightIncLarge);

  backdrop.querySelectorAll<HTMLElement>('.canvas-card').forEach((card) => {
    card.addEventListener('click', () => {
      const presetId = card.getAttribute('data-preset-id');
      if (presetId) {
        const item = ALL_PRESETS_MAP.get(presetId);
        if (item) {
          applyTemplateOrFormat(item);
          return;
        }
      }
      const w = parseInt(card.getAttribute('data-width') || '64', 10);
      const h = parseInt(card.getAttribute('data-height') || '64', 10);
      const name = card.getAttribute('data-name') || t('canvas.input_name_placeholder');
      applyTemplateOrFormat({ id: 'custom', name, width: w, height: h, svgIcon: '' });
    });
  });

  const performSearch = (query: string) => {
    const q = query.trim().toLowerCase();

    if (!q) {
      if (searchResultsContainer) searchResultsContainer.style.display = 'none';
      if (presetsEmptySearch) presetsEmptySearch.style.display = 'none';
      switchTab(currentTab);
      return;
    }

    tabButtons.forEach((btn) => btn?.classList.remove('is-active'));
    categoryPanels.forEach((panel) => {
      if (panel) panel.style.display = 'none';
    });
    if (panelCustomSize) panelCustomSize.style.display = 'none';
    if (panelUpload) panelUpload.style.display = 'none';

    const matches = ALL_PRESETS.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(q);
      const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
      const dimMatch = `${item.width}x${item.height}`.includes(q) || `${item.width} x ${item.height}`.includes(q);
      return nameMatch || catMatch || dimMatch;
    });

    if (matches.length === 0) {
      if (searchResultsContainer) searchResultsContainer.style.display = 'none';
      if (presetsEmptySearch) presetsEmptySearch.style.display = 'flex';
      return;
    }

    if (presetsEmptySearch) presetsEmptySearch.style.display = 'none';
    if (searchResultsContainer) searchResultsContainer.style.display = 'block';

    if (searchResultsGrid) {
      searchResultsGrid.innerHTML = matches.map(buildPresetCardHtml).join('');
      searchResultsGrid.querySelectorAll<HTMLElement>('.canvas-card').forEach((card) => {
        card.addEventListener('click', () => {
          const presetId = card.getAttribute('data-preset-id');
          if (presetId) {
            const item = ALL_PRESETS_MAP.get(presetId);
            if (item) {
              applyTemplateOrFormat(item);
              return;
            }
          }
          const w = parseInt(card.getAttribute('data-width') || '64', 10);
          const h = parseInt(card.getAttribute('data-height') || '64', 10);
          const name = card.getAttribute('data-name') || t('canvas.input_name_placeholder');
          applyTemplateOrFormat({ id: 'custom', name, width: w, height: h, svgIcon: '' });
        });
      });
    }
  };

  searchInput?.addEventListener('input', () => {
    performSearch(searchInput.value);
  });

  const showError = (msg: string) => {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
  };

  const hideError = () => {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  };

  const handleCreateCanvas = async () => {
    const name = inputName?.value.trim() || t('canvas.input_name_placeholder');
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);

    hideError();

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      showError('Las dimensiones deben ser mayores a 0.');
      return;
    }

    if (width > 16384 || height > 16384) {
      showError('Las dimensiones no pueden superar los 16384 píxeles.');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = t('modal.loading');
    }

    try {
      let templateDataUrl: string | null = null;

      if (activeTemplate) {
        const variant = activeTemplate.variants?.[activeVariantIndex];
        const imageSrc = variant?.imagePath || activeTemplate.imagePath;

        if (imageSrc) {
          try {
            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = false;
              const img = new Image();
              await new Promise<void>((resolve) => {
                let resolved = false;
                const done = () => {
                  if (resolved) return;
                  resolved = true;
                  try {
                    ctx.drawImage(img, 0, 0, width, height);
                  } catch {}
                  resolve();
                };
                img.onload = done;
                img.onerror = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                };
                img.src = imageSrc;
                if (img.complete && img.naturalWidth > 0) {
                  done();
                }
              });
              try {
                templateDataUrl = offscreen.toDataURL('image/png');
              } catch {}
            }
          } catch {}

          if (!templateDataUrl) {
            templateDataUrl = imageSrc;
          }
        }
      }

      let initialData: string | null = null;
      let previewThumbnail: string | null = null;

      if (templateDataUrl) {
        const initialProject = {
          version: 1,
          fps: 8,
          onionSkin: false,
          activeFrameId: 'frame_1',
          frames: [
            {
              id: 'frame_1',
              name: 'Cuadro 1',
              activeLayerId: 'layer_1',
              layers: [
                {
                  id: 'layer_1',
                  name: activeTemplate ? activeTemplate.name : 'Capa 1',
                  visible: true,
                  opacity: 1.0,
                  data: templateDataUrl,
                },
              ],
            },
          ],
        };
        initialData = JSON.stringify(initialProject);

        const maxThumbDim = 320;
        let thumbW = width;
        let thumbH = height;
        if (thumbW > maxThumbDim || thumbH > maxThumbDim) {
          const ratio = Math.min(maxThumbDim / thumbW, maxThumbDim / thumbH);
          thumbW = Math.max(1, Math.round(thumbW * ratio));
          thumbH = Math.max(1, Math.round(thumbH * ratio));
        }

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.imageSmoothingEnabled = false;
          const thumbImg = new Image();
          await new Promise<void>((r) => {
            thumbImg.onload = () => {
              try {
                thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
              } catch {}
              r();
            };
            thumbImg.onerror = () => r();
            thumbImg.src = templateDataUrl;
            if (thumbImg.complete && thumbImg.naturalWidth > 0) {
              try {
                thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
              } catch {}
              r();
            }
          });
          try {
            previewThumbnail = thumbCanvas.toDataURL('image/png');
          } catch {
            previewThumbnail = templateDataUrl;
          }
        } else {
          previewThumbnail = templateDataUrl;
        }
      }

      if (currentUser) {
        const res = await postApi(API_ROUTES.canvases.base, {
          name,
          width,
          height,
          unit: 'px',
          data: initialData,
          preview_thumbnail: previewThumbnail,
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            showToast(t('canvas.create_success'));
            closeModal();
            window.dispatchEvent(new CustomEvent('canvas-created', { detail: data.canvas }));
            if (data.canvas.uuid) {
              navigate('/design/' + data.canvas.uuid);
            } else if (window.location.pathname !== '/') {
              navigate('/');
            }
            return;
          }
        }

        let errMsg = 'No se pudo crear el lienzo.';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch {}
        showError(errMsg);
      } else {
        const localUuid = crypto.randomUUID();
        const localCanvas = await saveLocalCanvas({
          uuid: localUuid,
          name,
          width,
          height,
          unit: 'px',
          data: initialData,
          preview_thumbnail: previewThumbnail,
          is_local: true,
          created_at: new Date().toISOString(),
        });

        showToast(t('canvas.create_success'));
        closeModal();
        window.dispatchEvent(new CustomEvent('canvas-created', { detail: localCanvas }));
        if (localCanvas && localCanvas.uuid) {
          navigate('/design/' + localCanvas.uuid);
        } else if (window.location.pathname !== '/') {
          navigate('/');
        }
        return;
      }
    } catch {
      showError('Error al crear el lienzo. Intenta de nuevo.');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('canvas.btn_create');
      }
    }
  };

  btnSubmit?.addEventListener('click', handleCreateCanvas);

  const closeModal = () => {
    carouselControllers.forEach((c) => c.destroy());
    backdrop.remove();
    document.body.style.overflow = '';
    activeCreateCanvasModal = null;
  };

  activeCreateCanvasModal = { close: closeModal };

  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  closeBtn?.addEventListener('click', closeModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);
}
