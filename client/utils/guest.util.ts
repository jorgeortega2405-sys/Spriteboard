export interface GuestIdentity {
  animalKey: string;
  avatarUrl: string;
  color: string;
  id: number;
  username: string;
}

interface AnimalDefinition {
  bg: string;
  color: string;
  key: string;
  name: string;
  svgInner: string;
}

const GUEST_ANIMALS: AnimalDefinition[] = [
  {
    bg: '#E0F2FE',
    color: '#0284C7',
    key: 'panda',
    name: 'Panda Creativo',
    svgInner: `<circle cx="28" cy="24" r="10" fill="#1E293B"/><circle cx="68" cy="24" r="10" fill="#1E293B"/><circle cx="48" cy="52" r="32" fill="#FFFFFF"/><circle cx="36" cy="48" r="8" fill="#1E293B"/><circle cx="60" cy="48" r="8" fill="#1E293B"/><circle cx="38" cy="47" r="2.5" fill="#FFFFFF"/><circle cx="62" cy="47" r="2.5" fill="#FFFFFF"/><ellipse cx="48" cy="58" rx="5" ry="3.5" fill="#1E293B"/><path d="M44 63 Q48 66 52 63" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  },
  {
    bg: '#FFEDD5',
    color: '#EA580C',
    key: 'fox',
    name: 'Zorro Veloz',
    svgInner: `<polygon points="24,20 40,46 16,46" fill="#EA580C"/><polygon points="72,20 80,46 56,46" fill="#EA580C"/><polygon points="26,26 36,44 19,44" fill="#FFFFFF"/><polygon points="70,26 77,44 60,44" fill="#FFFFFF"/><polygon points="48,74 20,44 76,44" fill="#EA580C"/><polygon points="48,74 34,44 62,44" fill="#FFFFFF"/><circle cx="36" cy="48" r="3.5" fill="#1E293B"/><circle cx="60" cy="48" r="3.5" fill="#1E293B"/><circle cx="48" cy="68" r="4" fill="#1E293B"/>`,
  },
  {
    bg: '#F3E8FF',
    color: '#9333EA',
    key: 'cat',
    name: 'Gato Cósmico',
    svgInner: `<polygon points="24,24 38,44 18,44" fill="#9333EA"/><polygon points="72,24 78,44 58,44" fill="#9333EA"/><circle cx="48" cy="52" r="28" fill="#A855F7"/><ellipse cx="36" cy="50" rx="4" ry="6" fill="#FEF08A"/><ellipse cx="60" cy="50" rx="4" ry="6" fill="#FEF08A"/><ellipse cx="36" cy="50" rx="1.5" ry="4" fill="#1E293B"/><ellipse cx="60" cy="50" rx="1.5" ry="4" fill="#1E293B"/><polygon points="48,58 45,62 51,62" fill="#F472B6"/><path d="M48 62 L48 66 M48 66 Q44 69 40 67 M48 66 Q52 69 56 67" stroke="#1E293B" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    bg: '#FEF9C3',
    color: '#CA8A04',
    key: 'koala',
    name: 'Koala Soñador',
    svgInner: `<circle cx="24" cy="38" r="14" fill="#94A3B8"/><circle cx="72" cy="38" r="14" fill="#94A3B8"/><circle cx="24" cy="38" r="8" fill="#F1F5F9"/><circle cx="72" cy="38" r="8" fill="#F1F5F9"/><circle cx="48" cy="52" r="28" fill="#CBD5E1"/><circle cx="36" cy="48" r="4" fill="#1E293B"/><circle cx="60" cy="48" r="4" fill="#1E293B"/><ellipse cx="48" cy="57" rx="8" ry="12" fill="#334155"/>`,
  },
  {
    bg: '#CCFBF1',
    color: '#0D9488',
    key: 'otter',
    name: 'Nutria Curiosa',
    svgInner: `<circle cx="26" cy="32" r="8" fill="#78350F"/><circle cx="70" cy="32" r="8" fill="#78350F"/><circle cx="48" cy="52" r="28" fill="#92400E"/><ellipse cx="48" cy="58" rx="18" ry="14" fill="#FEF3C7"/><circle cx="36" cy="48" r="3.5" fill="#1E293B"/><circle cx="60" cy="48" r="3.5" fill="#1E293B"/><polygon points="48,54 44,59 52,59" fill="#1E293B"/><path d="M48 59 L48 64 M48 64 Q43 67 39 64 M48 64 Q53 67 57 64" stroke="#1E293B" stroke-width="1.5" fill="none"/>`,
  },
  {
    bg: '#E0E7FF',
    color: '#4F46E5',
    key: 'owl',
    name: 'Búho Sabio',
    svgInner: `<polygon points="28,24 38,40 22,40" fill="#4338CA"/><polygon points="68,24 74,40 58,40" fill="#4338CA"/><circle cx="48" cy="52" r="28" fill="#6366F1"/><circle cx="36" cy="48" r="11" fill="#FFFFFF"/><circle cx="60" cy="48" r="11" fill="#FFFFFF"/><circle cx="36" cy="48" r="5" fill="#1E293B"/><circle cx="60" cy="48" r="5" fill="#1E293B"/><polygon points="48,50 44,60 52,60" fill="#F59E0B"/>`,
  },
  {
    bg: '#DCFCE7',
    color: '#16A34A',
    key: 'rabbit',
    name: 'Conejo Saltarín',
    svgInner: `<ellipse cx="36" cy="24" rx="7" ry="18" fill="#FBCFE8"/><ellipse cx="60" cy="24" rx="7" ry="18" fill="#FBCFE8"/><ellipse cx="36" cy="24" rx="4" ry="14" fill="#F472B6"/><ellipse cx="60" cy="24" rx="4" ry="14" fill="#F472B6"/><circle cx="48" cy="54" r="26" fill="#FDF2F8"/><circle cx="36" cy="50" r="3.5" fill="#1E293B"/><circle cx="60" cy="50" r="3.5" fill="#1E293B"/><ellipse cx="48" cy="58" rx="4" ry="2.5" fill="#F472B6"/><path d="M48 60.5 L48 64 M48 64 Q44 67 40 65 M48 64 Q52 67 56 65" stroke="#1E293B" stroke-width="1.5" fill="none"/>`,
  },
  {
    bg: '#FFE4E6',
    color: '#E11D48',
    key: 'raccoon',
    name: 'Mapache Ágil',
    svgInner: `<polygon points="26,24 38,40 18,40" fill="#475569"/><polygon points="70,24 78,40 58,40" fill="#475569"/><circle cx="48" cy="52" r="28" fill="#94A3B8"/><ellipse cx="34" cy="48" rx="12" ry="7" fill="#1E293B" transform="rotate(-10 34 48)"/><ellipse cx="62" cy="48" rx="12" ry="7" fill="#1E293B" transform="rotate(10 62 48)"/><circle cx="34" cy="48" r="3.5" fill="#FFFFFF"/><circle cx="62" cy="48" r="3.5" fill="#FFFFFF"/><ellipse cx="48" cy="58" rx="12" ry="9" fill="#F1F5F9"/><circle cx="48" cy="56" r="3" fill="#1E293B"/>`,
  },
  {
    bg: '#CFFAFE',
    color: '#0891B2',
    key: 'penguin',
    name: 'Pingüino Explorador',
    svgInner: `<ellipse cx="48" cy="50" rx="26" ry="30" fill="#0F172A"/><ellipse cx="48" cy="54" rx="18" ry="22" fill="#FFFFFF"/><circle cx="38" cy="44" r="3.5" fill="#0F172A"/><circle cx="58" cy="44" r="3.5" fill="#0F172A"/><polygon points="48,46 41,56 55,56" fill="#F59E0B"/><ellipse cx="48" cy="74" rx="10" ry="3" fill="#F59E0B"/>`,
  },
  {
    bg: '#FEF3C7',
    color: '#D97706',
    key: 'tiger',
    name: 'Tigre Valiente',
    svgInner: `<circle cx="26" cy="30" r="9" fill="#D97706"/><circle cx="70" cy="30" r="9" fill="#D97706"/><circle cx="48" cy="52" r="28" fill="#F59E0B"/><polygon points="48,26 45,34 51,34" fill="#1E293B"/><polygon points="34,30 32,38 38,36" fill="#1E293B"/><polygon points="62,30 64,38 58,36" fill="#1E293B"/><circle cx="36" cy="48" r="4" fill="#1E293B"/><circle cx="60" cy="48" r="4" fill="#1E293B"/><polygon points="48,54 44,59 52,59" fill="#1E293B"/><ellipse cx="48" cy="62" rx="14" ry="8" fill="#FEF3C7"/>`,
  },
  {
    bg: '#EDE9FE',
    color: '#7C3AED',
    key: 'wolf',
    name: 'Lobo Guardián',
    svgInner: `<polygon points="24,20 38,44 18,44" fill="#475569"/><polygon points="72,20 78,44 58,44" fill="#475569"/><circle cx="48" cy="52" r="28" fill="#64748B"/><polygon points="48,72 26,48 70,48" fill="#64748B"/><polygon points="48,72 34,48 62,48" fill="#F1F5F9"/><ellipse cx="36" cy="46" rx="4" ry="3" fill="#FBBF24"/><ellipse cx="60" cy="46" rx="4" ry="3" fill="#FBBF24"/><circle cx="36" cy="46" r="2" fill="#1E293B"/><circle cx="60" cy="46" r="2" fill="#1E293B"/><circle cx="48" cy="66" r="3.5" fill="#1E293B"/>`,
  },
  {
    bg: '#E0F2FE',
    color: '#2563EB',
    key: 'dolphin',
    name: 'Delfín Alegre',
    svgInner: `<path d="M20 60 Q28 26 68 34 Q80 44 76 60 Q56 64 20 60 Z" fill="#3B82F6"/><path d="M48 30 Q54 18 62 26 Q56 32 52 34 Z" fill="#2563EB"/><ellipse cx="46" cy="58" rx="22" ry="8" fill="#EFF6FF"/><circle cx="64" cy="44" r="3" fill="#1E293B"/><circle cx="65" cy="43" r="1" fill="#FFFFFF"/><path d="M68 50 Q74 54 70 56" stroke="#1E293B" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    bg: '#FDF4FF',
    color: '#C026D3',
    key: 'bear',
    name: 'Oso Diseñador',
    svgInner: `<circle cx="24" cy="28" r="11" fill="#78350F"/><circle cx="72" cy="28" r="11" fill="#78350F"/><circle cx="24" cy="28" r="6" fill="#FDE68A"/><circle cx="72" cy="28" r="6" fill="#FDE68A"/><circle cx="48" cy="52" r="28" fill="#92400E"/><ellipse cx="48" cy="59" rx="14" ry="11" fill="#FDE68A"/><circle cx="36" cy="46" r="3.5" fill="#1E293B"/><circle cx="60" cy="46" r="3.5" fill="#1E293B"/><ellipse cx="48" cy="56" rx="6" ry="4" fill="#1E293B"/><path d="M48 60 L48 64 M48 64 Q44 67 41 65 M48 64 Q52 67 55 65" stroke="#1E293B" stroke-width="1.5" fill="none"/>`,
  },
  {
    bg: '#F0FDF4',
    color: '#059669',
    key: 'lemur',
    name: 'Lémur Aventurero',
    svgInner: `<circle cx="26" cy="30" r="9" fill="#64748B"/><circle cx="70" cy="30" r="9" fill="#64748B"/><circle cx="48" cy="52" r="28" fill="#94A3B8"/><circle cx="34" cy="48" r="11" fill="#1E293B"/><circle cx="62" cy="48" r="11" fill="#1E293B"/><circle cx="34" cy="48" r="8" fill="#F59E0B"/><circle cx="62" cy="48" r="8" fill="#F59E0B"/><circle cx="34" cy="48" r="4" fill="#1E293B"/><circle cx="62" cy="48" r="4" fill="#1E293B"/><polygon points="48,56 44,62 52,62" fill="#1E293B"/>`,
  },
  {
    bg: '#FFFBEB',
    color: '#B45309',
    key: 'hedgehog',
    name: 'Erizo Detallista',
    svgInner: `<circle cx="48" cy="50" r="30" fill="#78350F"/><polygon points="20,30 26,42 16,42" fill="#451A03"/><polygon points="76,30 80,42 70,42" fill="#451A03"/><polygon points="48,18 42,28 54,28" fill="#451A03"/><ellipse cx="48" cy="56" rx="20" ry="18" fill="#FED7AA"/><circle cx="38" cy="52" r="3.5" fill="#1E293B"/><circle cx="58" cy="52" r="3.5" fill="#1E293B"/><circle cx="48" cy="62" r="3.5" fill="#1E293B"/>`,
  },
  {
    bg: '#FFF1F2',
    color: '#BE123C',
    key: 'toucan',
    name: 'Tucán Colorido',
    svgInner: `<circle cx="44" cy="50" r="26" fill="#0F172A"/><circle cx="36" cy="46" r="10" fill="#38BDF8"/><circle cx="36" cy="46" r="4" fill="#0F172A"/><path d="M42 42 Q76 34 84 52 Q68 62 42 58 Z" fill="#F59E0B"/><path d="M72 42 Q84 48 84 52 Q76 56 68 54 Z" fill="#EF4444"/><circle cx="38" cy="44" r="1.5" fill="#FFFFFF"/>`,
  },
];

const COLLABORATOR_COLORS = [
  '#FF5722',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#FF9800',
  '#795548',
  '#607D8B',
  '#00E5FF',
  '#76FF03',
  '#FF4081',
];

export function generateAnimalSvg(animal: AnimalDefinition, size = 96): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <rect width="96" height="96" rx="48" fill="${animal.bg}"/>
  ${animal.svgInner}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const STORAGE_KEY = 'sb_guest_identity';

export function getGuestIdentity(): GuestIdentity {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'number' && parsed.username && parsed.avatarUrl) {
        return parsed as GuestIdentity;
      }
    }
  } catch {}

  const animalIndex = Math.floor(Math.random() * GUEST_ANIMALS.length);
  const animal = GUEST_ANIMALS[animalIndex];
  const colorIndex = Math.floor(Math.random() * COLLABORATOR_COLORS.length);
  const color = COLLABORATOR_COLORS[colorIndex];
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const id = -guestNumber;
  const avatarUrl = generateAnimalSvg(animal, 96);

  const identity: GuestIdentity = {
    animalKey: animal.key,
    avatarUrl,
    color,
    id,
    username: animal.name,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {}

  return identity;
}
