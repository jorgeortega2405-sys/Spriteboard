import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const TEMPLATE_IDS = [
  'forest',
  'waterfall',
  'mountain',
  'beach',
  'lake',
  'desert',
  'swamp',
  'canyon',
  'volcano',
  'meadow',
];

const RESOLUTIONS = [
  { width: 256, height: 128 },
  { width: 320, height: 160 },
  { width: 512, height: 256 },
  { width: 640, height: 320 },
  { width: 1024, height: 512 },
  { width: 1280, height: 640 },
  { width: 1536, height: 768 },
  { width: 1920, height: 960 },
  { width: 2560, height: 1280 },
  { width: 3840, height: 1920 },
];

async function run(): Promise<void> {
  const targetDir = path.join(process.cwd(), 'public/assets/templates/nature');
  const mastersDir = path.join(targetDir, 'masters');

  process.stdout.write(`Iniciando procesamiento de Propuesta A (Retro a 4K) para ${TEMPLATE_IDS.length} plantillas...\n`);

  for (const id of TEMPLATE_IDS) {
    const masterPath = path.join(mastersDir, `${id}_master.png`);
    if (!fs.existsSync(masterPath)) {
      throw new Error(`Master no encontrado: ${masterPath}`);
    }

    const masterBuf = await fs.promises.readFile(masterPath);

    for (const res of RESOLUTIONS) {
      const outPath = path.join(targetDir, `${id}_${res.width}x${res.height}.png`);
      await sharp(masterBuf)
        .resize(res.width, res.height, { fit: 'cover', position: 'center' })
        .png({ compressionLevel: 1, effort: 1 })
        .toFile(outPath);
    }
    process.stdout.write(`[OK] ${id} (10 resoluciones de 256x128 a 3840x1920)\n`);
  }

  process.stdout.write(`\nCompletado exitosamente: 100 imágenes en formato 2:1 (Propuesta A) generadas.\n`);
}

run().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
