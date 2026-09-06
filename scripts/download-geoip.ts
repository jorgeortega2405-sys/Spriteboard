import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.resolve(__dirname, '../data/geoip');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function downloadFile(url: string, destPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'Spriteboard-GeoIP-Updater/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, destPath));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage} para ${url}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function decompressGz(gzPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(gzPath);
    const writeStream = fs.createWriteStream(outputPath);
    const gunzip = zlib.createGunzip();

    readStream
      .pipe(gunzip)
      .pipe(writeStream)
      .on('finish', () => {
        writeStream.close();
        try {
          fs.unlinkSync(gzPath);
        } catch (_) {}
        resolve(outputPath);
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(outputPath);
        } catch (_) {}
        reject(err);
      });
  });
}

function getCandidateDates(): string[] {
  const now = new Date();
  const dates: string[] = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    dates.push(`${year}-${month}`);
  }
  return dates;
}

async function downloadDbIpDatabase(type: 'city' | 'asn'): Promise<boolean> {
  const dates = getCandidateDates();
  let lastError: any = null;

  for (const dateStr of dates) {
    const fileName = `dbip-${type}-lite-${dateStr}.mmdb.gz`;
    const url = `https://download.db-ip.com/free/${fileName}`;
    const gzPath = path.join(DEST_DIR, fileName);
    const finalName = type === 'city' ? 'GeoLite2-City.mmdb' : 'GeoLite2-ASN.mmdb';
    const finalPath = path.join(DEST_DIR, finalName);

    process.stdout.write(`Intentando descargar ${type.toUpperCase()} de DB-IP (${dateStr})...\n`);

    try {
      await downloadFile(url, gzPath);
      process.stdout.write(`Descomprimiendo ${fileName}...\n`);
      await decompressGz(gzPath, finalPath);

      process.stdout.write(`¡Base de datos ${type.toUpperCase()} instalada con éxito en ${finalPath}!\n`);
      return true;
    } catch (err: any) {
      lastError = err;
      process.stdout.write(`No disponible para ${dateStr}: ${err.message}. Probando siguiente fecha...\n`);
      if (fs.existsSync(gzPath)) {
        try { fs.unlinkSync(gzPath); } catch (_) {}
      }
    }
  }

  throw lastError || new Error(`No se pudo descargar la base de datos ${type}`);
}

async function main(): Promise<void> {
  process.stdout.write('Iniciando descarga de bases de datos locales GeoIP y ASN...\n');
  process.stdout.write(`Directorio de destino: ${DEST_DIR}\n\n`);

  try {
    await downloadDbIpDatabase('city');
    process.stdout.write('\n');
    await downloadDbIpDatabase('asn');
    process.stdout.write('\n¡Bases de datos GeoIP y ASN descargadas e instaladas correctamente!\n');
  } catch (err: any) {
    process.stderr.write(`\nError al descargar bases de datos GeoIP: ${err.message}\n`);
    process.stderr.write('Puedes descargar manualmente los archivos GeoLite2-City.mmdb y GeoLite2-ASN.mmdb y colocarlos en la carpeta data/geoip/\n');
    process.exit(1);
  }
}

main();
