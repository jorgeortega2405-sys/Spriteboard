import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

interface TemplateItemConfig {
  id: string;
  category: string;
  photoId: string;
  isWide?: boolean;
}

const TEMPLATE_CONFIGS: TemplateItemConfig[] = [
  // NATURE
  { id: 'forest', category: 'nature', photoId: 'photo-1448375240586-882707db888b', isWide: true },
  { id: 'beach', category: 'nature', photoId: 'photo-1507525428034-b723cf961d3e', isWide: true },
  { id: 'waterfall', category: 'nature', photoId: 'photo-1432405972618-c60b0225b8f9', isWide: true },
  { id: 'swamp', category: 'nature', photoId: 'photo-1518457607834-6e8d80c183c5', isWide: true },
  { id: 'flower_field', category: 'nature', photoId: 'photo-1490750967868-88aa4486c946', isWide: true },
  { id: 'mountain', category: 'nature', photoId: 'photo-1464822759023-fed622ff2c3b', isWide: true },
  { id: 'sunset_desert', category: 'nature', photoId: 'photo-1509316975850-ff9c5deb0cd9', isWide: true },
  { id: 'crystal_cave', category: 'nature', photoId: 'photo-1508873696983-2df5703bc20d' },
  { id: 'volcano', category: 'nature', photoId: 'photo-1462331940025-496dfbfc7564', isWide: true },
  { id: 'coral_reef', category: 'nature', photoId: 'photo-1546026423-cc4642628d2b', isWide: true },

  // CITIES
  { id: 'night_metropolis', category: 'cities', photoId: 'photo-1519501025264-65ba15a82390', isWide: true },
  { id: 'cyber_alley', category: 'cities', photoId: 'photo-1509198397868-475647b2a1e5' },
  { id: 'tokyo_street', category: 'cities', photoId: 'photo-1503899036084-c55cdd92da26', isWide: true },
  { id: 'city_rooftop', category: 'cities', photoId: 'photo-1513694203232-719a280e022f', isWide: true },
  { id: 'autumn_suburb', category: 'cities', photoId: 'photo-1513836279014-a89f7a76ae86', isWide: true },
  { id: 'medieval_town', category: 'cities', photoId: 'photo-1534447677768-be436bb09401', isWide: true },
  { id: 'seaport', category: 'cities', photoId: 'photo-1505761671935-60b3a7427bad', isWide: true },
  { id: 'hill_castle', category: 'cities', photoId: 'photo-1524397076594-5035ec2131bb', isWide: true },
  { id: 'train_station', category: 'cities', photoId: 'photo-1515162816999-a0c47dc192f7', isWide: true },
  { id: 'ancient_market', category: 'cities', photoId: 'photo-1533900298318-6b8da08a523e', isWide: true },

  // FANTASY
  { id: 'dark_dungeon', category: 'fantasy', photoId: 'photo-1518709268805-4e9042af9f23' },
  { id: 'throne_room', category: 'fantasy', photoId: 'photo-1541123437800-1bb1317badc2', isWide: true },
  { id: 'mystic_portal', category: 'fantasy', photoId: 'photo-1518709268805-4e9042af9f23' },
  { id: 'treasure_chest', category: 'fantasy', photoId: 'photo-1569683795645-b62e50fbf103' },
  { id: 'elven_ruins', category: 'fantasy', photoId: 'photo-1518709268805-4e9042af9f23', isWide: true },
  { id: 'potion_shop', category: 'fantasy', photoId: 'photo-1514933651103-005eec06c04b' },
  { id: 'dwarven_forge', category: 'fantasy', photoId: 'photo-1504917599217-d4dc5ebe6122' },
  { id: 'wizard_tower', category: 'fantasy', photoId: 'photo-1514565131-fce0801e5785' },
  { id: 'dragon_bridge', category: 'fantasy', photoId: 'photo-1513836279014-a89f7a76ae86', isWide: true },
  { id: 'arcane_altar', category: 'fantasy', photoId: 'photo-1518709268805-4e9042af9f23' },

  // SCIFI
  { id: 'orbital_station', category: 'scifi', photoId: 'photo-1451187580459-43490279c0fa', isWide: true },
  { id: 'cosmic_nebula', category: 'scifi', photoId: 'photo-1462331940025-496dfbfc7564', isWide: true },
  { id: 'ringed_planet', category: 'scifi', photoId: 'photo-1614728894747-a83421e2b9c9' },
  { id: 'lunar_surface', category: 'scifi', photoId: 'photo-1522030299830-16b8d3d049fe', isWide: true },
  { id: 'cockpit', category: 'scifi', photoId: 'photo-1517976487502-d710d65ff291', isWide: true },
  { id: 'mining_asteroid', category: 'scifi', photoId: 'photo-1446776811953-b23d57bd21aa' },
  { id: 'floating_city', category: 'scifi', photoId: 'photo-1477959858617-67f30bc75b82', isWide: true },
  { id: 'alien_lab', category: 'scifi', photoId: 'photo-1507668077129-56e32842fceb' },
  { id: 'wormhole', category: 'scifi', photoId: 'photo-1506703719100-a0f3a48c0f86' },
  { id: 'solar_satellite', category: 'scifi', photoId: 'photo-1446776877081-d282a0f896e2', isWide: true },

  // CHARACTERS
  { id: 'humanoid_base', category: 'characters', photoId: 'photo-1500648767791-00dcc994a43e' },
  { id: 'warrior_side', category: 'characters', photoId: 'photo-1507003211169-0a1dd7228f2d' },
  { id: 'mannequin_f', category: 'characters', photoId: 'photo-1534528741775-53994a69daeb' },
  { id: 'mannequin_m', category: 'characters', photoId: 'photo-1506794778202-cad84cf45f1d' },
  { id: 'sprite_sheet_4way', category: 'characters', photoId: 'photo-1517841905240-472988babdf9' },
  { id: 'chibi_portrait', category: 'characters', photoId: 'photo-1544005313-94ddf0286df2' },
  { id: 'mage_robe', category: 'characters', photoId: 'photo-1519085360753-af0119f7cbe7' },
  { id: 'armored_knight', category: 'characters', photoId: 'photo-1579783900882-c0d3dad7b119' },
  { id: 'slime_creature', category: 'characters', photoId: 'photo-1518770660439-4636190af475' },
  { id: 'skull_monster', category: 'characters', photoId: 'photo-1509198397868-475647b2a1e5' },

  // ITEMS
  { id: 'crystal_sword', category: 'items', photoId: 'photo-1589254065878-42c9da997008' },
  { id: 'heraldic_shield', category: 'items', photoId: 'photo-1589829545856-d10d557cf95f' },
  { id: 'warrior_helmet', category: 'items', photoId: 'photo-1589829545856-d10d557cf95f' },
  { id: 'elven_bow', category: 'items', photoId: 'photo-1511407397940-d57f68e81203' },
  { id: 'gold_ingot', category: 'items', photoId: 'photo-1610375461246-83df859d849d' },
  { id: 'mana_potion', category: 'items', photoId: 'photo-1514933651103-005eec06c04b' },
  { id: 'spellbook', category: 'items', photoId: 'photo-1544716278-ca5e3f4abd8c' },
  { id: 'gemstone', category: 'items', photoId: 'photo-1551028719-00167b16eac5' },
  { id: 'golden_key', category: 'items', photoId: 'photo-1582139329536-e7284fece509' },
  { id: 'crystal_skull', category: 'items', photoId: 'photo-1518709268805-4e9042af9f23' },
];

async function fetchBufferWithFallback(cfg: TemplateItemConfig): Promise<Buffer> {
  const unsplashUrl = `https://images.unsplash.com/${cfg.photoId}?w=800&h=800&fit=crop&q=80`;
  try {
    const res = await fetch(unsplashUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    }
  } catch {}

  const picsumUrl = `https://picsum.photos/seed/${cfg.category}_${cfg.id}/800/800`;
  const res2 = await fetch(picsumUrl, { signal: AbortSignal.timeout(6000) });
  if (res2.ok) {
    const arr = await res2.arrayBuffer();
    return Buffer.from(arr);
  }
  throw new Error(`Failed to download image for ${cfg.id}`);
}

async function processTemplate(cfg: TemplateItemConfig, baseDir: string): Promise<number> {
  const catDir = path.join(baseDir, cfg.category);
  if (!fs.existsSync(catDir)) {
    fs.mkdirSync(catDir, { recursive: true });
  }

  const originalBuf = await fetchBufferWithFallback(cfg);

  // Variant 1: 512x512
  const path512 = path.join(catDir, `${cfg.id}_512x512.png`);
  await sharp(originalBuf)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png({ quality: 85, compressionLevel: 5 })
    .toFile(path512);

  // Variant 2: 1024x1024
  const path1024 = path.join(catDir, `${cfg.id}_1024x1024.png`);
  await sharp(originalBuf)
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .png({ quality: 85, compressionLevel: 5 })
    .toFile(path1024);

  // Variant 3: 1920x1080 (if wide) or 768x512
  const w3 = cfg.isWide ? 1920 : 768;
  const h3 = cfg.isWide ? 1080 : 768;
  const path3 = path.join(catDir, `${cfg.id}_${w3}x${h3}.png`);
  await sharp(originalBuf)
    .resize(w3, h3, { fit: 'cover', position: 'center' })
    .png({ quality: 85, compressionLevel: 5 })
    .toFile(path3);

  process.stdout.write(`[OK] ${cfg.category}/${cfg.id}\n`);
  return 3;
}

async function run(): Promise<void> {
  const baseDir = path.join(process.cwd(), 'public/assets/templates');
  let count = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < TEMPLATE_CONFIGS.length; i += BATCH_SIZE) {
    const batch = TEMPLATE_CONFIGS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((cfg) => processTemplate(cfg, baseDir))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        count += r.value;
      }
    }
  }

  process.stdout.write(`\nTotal completado: ${count} archivos PNG de alta resolución generados.\n`);
}

run().catch((err) => {
  process.stderr.write(`Error global: ${err}\n`);
  process.exit(1);
});
