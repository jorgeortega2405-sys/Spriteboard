import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import fs from 'fs';
import maxmind, { AsnResponse, CityResponse, Reader } from 'maxmind';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_GEOIP_DIR = path.resolve(__dirname, '../../data/geoip');

export interface GeoIpLookupResult {
  ip: string;
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  asn: string | null;
  asOrg: string | null;
  isLocal: boolean;
}

class GeoIpService {
  private cityReader: Reader<CityResponse> | null = null;
  private asnReader: Reader<AsnResponse> | null = null;
  private isInitialized = false;

  private findCityDbPath(): string | null {
    if (config.geoip.cityDbPath && fs.existsSync(config.geoip.cityDbPath)) {
      return config.geoip.cityDbPath;
    }

    const candidates = [
      path.join(DATA_GEOIP_DIR, 'GeoLite2-City.mmdb'),
      path.join(DATA_GEOIP_DIR, 'dbip-city-lite.mmdb'),
      path.join(DATA_GEOIP_DIR, 'GeoLite2-Country.mmdb'),
      path.join(DATA_GEOIP_DIR, 'dbip-country-lite.mmdb'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private findAsnDbPath(): string | null {
    if (config.geoip.asnDbPath && fs.existsSync(config.geoip.asnDbPath)) {
      return config.geoip.asnDbPath;
    }

    const candidates = [
      path.join(DATA_GEOIP_DIR, 'GeoLite2-ASN.mmdb'),
      path.join(DATA_GEOIP_DIR, 'dbip-asn-lite.mmdb'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  public async init(): Promise<void> {
    try {
      const cityPath = this.findCityDbPath();
      const asnPath = this.findAsnDbPath();

      if (cityPath) {
        this.cityReader = await maxmind.open<CityResponse>(cityPath);
        logger.app.info('Base de datos GeoIP City cargada exitosamente', { path: path.basename(cityPath) });
      } else {
        logger.app.info(
          'Base de datos GeoIP City no encontrada en data/geoip. Se omitirá geolocalización de ciudad hasta proveer el archivo MMDB.'
        );
      }

      if (asnPath) {
        this.asnReader = await maxmind.open<AsnResponse>(asnPath);
        logger.app.info('Base de datos GeoIP ASN cargada exitosamente', { path: path.basename(asnPath) });
      } else {
        logger.app.info(
          'Base de datos GeoIP ASN no encontrada en data/geoip. Se omitirá detección de proveedor/ISP hasta proveer el archivo MMDB.'
        );
      }

      this.isInitialized = true;
    } catch (err) {
      logger.app.error('Error al inicializar bases de datos locales GeoIP', err);
      this.isInitialized = true;
    }
  }

  public isLocalOrPrivateIp(rawIp: string): boolean {
    const ip = this.normalizeIp(rawIp);
    if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
      return true;
    }

    if (
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^169\.254\./.test(ip) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    ) {
      return true;
    }

    if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) {
      return true;
    }

    return false;
  }

  public normalizeIp(ip?: string | null): string {
    if (!ip) return '127.0.0.1';
    let clean = ip.trim();
    if (clean.startsWith('::ffff:')) {
      clean = clean.substring(7);
    }
    return clean;
  }

  public lookup(rawIp: string): GeoIpLookupResult {
    const ip = this.normalizeIp(rawIp);
    const isLocal = this.isLocalOrPrivateIp(ip);

    if (isLocal) {
      return {
        ip,
        countryCode: 'LOCAL',
        countryName: 'Red Local / Privada',
        region: null,
        city: 'Localhost',
        timezone: null,
        asn: null,
        asOrg: 'Red Local / Privada',
        isLocal: true,
      };
    }

    let countryCode: string | null = null;
    let countryName: string | null = null;
    let region: string | null = null;
    let city: string | null = null;
    let timezone: string | null = null;
    let asn: string | null = null;
    let asOrg: string | null = null;

    if (this.cityReader) {
      try {
        const cityData = this.cityReader.get(ip);
        if (cityData) {
          countryCode = cityData.country?.iso_code || cityData.registered_country?.iso_code || null;
          countryName = cityData.country?.names?.es || cityData.country?.names?.en || null;
          if (cityData.subdivisions && cityData.subdivisions.length > 0) {
            region = cityData.subdivisions[0]?.names?.es || cityData.subdivisions[0]?.names?.en || null;
          }
          city = cityData.city?.names?.es || cityData.city?.names?.en || null;
          timezone = cityData.location?.time_zone || null;
        }
      } catch (err) {
        logger.app.warn('Error al resolver ciudad/país para IP en GeoIP', { ip, err });
      }
    }

    if (this.asnReader) {
      try {
        const asnData = this.asnReader.get(ip);
        if (asnData) {
          if (asnData.autonomous_system_number) {
            asn = `AS${asnData.autonomous_system_number}`;
          }
          asOrg = asnData.autonomous_system_organization || null;
        }
      } catch (err) {
        logger.app.warn('Error al resolver ASN/ISP para IP en GeoIP', { ip, err });
      }
    }

    return {
      ip,
      countryCode,
      countryName,
      region,
      city,
      timezone,
      asn,
      asOrg,
      isLocal: false,
    };
  }

  public async reload(): Promise<void> {
    await this.init();
  }

  public isReady(): boolean {
    return this.isInitialized && (this.cityReader !== null || this.asnReader !== null);
  }
}

export const geoIpService = new GeoIpService();
