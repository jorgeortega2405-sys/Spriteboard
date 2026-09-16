import fs from 'fs';
import path from 'path';
import { logger } from './logger.service.js';
import { LogCategory, LogFileContent, LogFileRecord, LogLevel, LogServiceSource, LogStats, ParsedLogLine } from '../types/log.types.js';

const CATEGORIES: LogCategory[] = ['app', 'database', 'security'];

const CATEGORY_LABELS: Record<LogCategory, string> = {
  app: 'Aplicación',
  database: 'Base de Datos',
  security: 'Seguridad',
};

const SERVICE_LABELS: Record<LogServiceSource, string> = {
  admin: 'Admin (3002)',
  web: 'Web (3000)',
};

function getLogsBaseDir(service: LogServiceSource): string {
  if (service === 'admin') {
    return path.resolve(process.cwd(), 'logs');
  }

  const inDockerLogs = path.resolve(process.cwd(), 'main_logs');
  if (fs.existsSync(inDockerLogs)) {
    return inDockerLogs;
  }

  const hostLogs = path.resolve(process.cwd(), '../logs');
  if (fs.existsSync(hostLogs)) {
    return hostLogs;
  }

  return inDockerLogs;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const LOG_HEADER_REGEX = /^\[([^\]]+)\]\s*\[(INFO|WARN|ERROR|DEBUG)\]\s*(?:\[([^\]]+)\])?\s*(.*)$/i;

function parseLogLine(raw: string, lineNumber: number): ParsedLogLine {
  const match = raw.match(LOG_HEADER_REGEX);
  if (match) {
    const rawLevel = match[2].toUpperCase() as LogLevel;
    return {
      category: match[3] || undefined,
      level: rawLevel,
      lineNumber,
      message: match[4] || '',
      raw,
      timestamp: match[1],
    };
  }

  return {
    lineNumber,
    message: raw,
    raw,
  };
}

function parseFileId(fileId: string): { category: LogCategory; fileName: string; service: LogServiceSource } | null {
  const parts = fileId.split('__');
  if (parts.length !== 3) return null;

  const service = parts[0] as LogServiceSource;
  const category = parts[1] as LogCategory;
  const fileName = parts[2];

  if (service !== 'web' && service !== 'admin') return null;
  if (!CATEGORIES.includes(category)) return null;
  if (!fileName || !/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.includes('..')) return null;

  return { category, fileName, service };
}

function buildFileId(service: LogServiceSource, category: LogCategory, fileName: string): string {
  return `${service}__${category}__${fileName}`;
}

export async function listLogFiles(): Promise<LogFileRecord[]> {
  const records: LogFileRecord[] = [];
  const services: LogServiceSource[] = ['web', 'admin'];
  const tasks: Promise<void>[] = [];

  for (const service of services) {
    const baseDir = getLogsBaseDir(service);
    if (!fs.existsSync(baseDir)) continue;

    for (const category of CATEGORIES) {
      const catDir = path.join(baseDir, category);
      if (!fs.existsSync(catDir)) continue;

      tasks.push(
        (async () => {
          try {
            const files = await fs.promises.readdir(catDir);
            await Promise.all(
              files.map(async (fileName) => {
                if (!fileName.endsWith('.log')) return;

                const filePath = path.join(catDir, fileName);
                try {
                  const stat = await fs.promises.stat(filePath);
                  if (!stat.isFile()) return;

                  const content = await fs.promises.readFile(filePath, 'utf8');
                  const lines = content.split('\n');
                  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

                  let errorCount = 0;
                  let warnCount = 0;

                  for (const line of nonEmptyLines) {
                    if (line.includes('[ERROR]')) {
                      errorCount++;
                    } else if (line.includes('[WARN]')) {
                      warnCount++;
                    }
                  }

                  records.push({
                    category,
                    categoryLabel: CATEGORY_LABELS[category],
                    errorCount,
                    fileName,
                    id: buildFileId(service, category, fileName),
                    lineCount: nonEmptyLines.length,
                    service,
                    serviceLabel: SERVICE_LABELS[service],
                    sizeBytes: stat.size,
                    sizeFormatted: formatBytes(stat.size),
                    updatedAt: stat.mtime.toISOString(),
                    warnCount,
                  });
                } catch (fileErr) {
                  logger.app.warn(`Error al leer archivo de log individual: ${filePath}`, fileErr);
                }
              })
            );
          } catch (dirErr) {
            logger.app.warn(`Error al leer directorio de logs: ${catDir}`, dirErr);
          }
        })()
      );
    }
  }

  await Promise.all(tasks);
  records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return records;
}

export async function getLogFilesContent(fileIds: string[]): Promise<LogFileContent[]> {
  const results: LogFileContent[] = [];

  for (const fileId of fileIds) {
    const parsed = parseFileId(fileId);
    if (!parsed) continue;

    const baseDir = getLogsBaseDir(parsed.service);
    const filePath = path.join(baseDir, parsed.category, parsed.fileName);
    const resolvedPath = path.resolve(filePath);
    const expectedDir = path.resolve(baseDir, parsed.category);

    if (!resolvedPath.startsWith(expectedDir)) {
      logger.security.warn(`Intento de acceso a ruta no permitida en logs: ${fileId}`);
      continue;
    }

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    try {
      const stat = await fs.promises.stat(resolvedPath);
      const rawContent = await fs.promises.readFile(resolvedPath, 'utf8');
      const rawLines = rawContent.split('\n');

      const parsedLines: ParsedLogLine[] = [];
      const stats: LogStats = {
        debugCount: 0,
        errorCount: 0,
        infoCount: 0,
        totalLines: 0,
        warnCount: 0,
      };

      for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        if (i === rawLines.length - 1 && rawLine.trim().length === 0) continue;

        const lineObj = parseLogLine(rawLine, i + 1);
        parsedLines.push(lineObj);
        stats.totalLines++;

        if (lineObj.level === 'ERROR') stats.errorCount++;
        else if (lineObj.level === 'WARN') stats.warnCount++;
        else if (lineObj.level === 'INFO') stats.infoCount++;
        else if (lineObj.level === 'DEBUG') stats.debugCount++;
      }

      results.push({
        category: parsed.category,
        categoryLabel: CATEGORY_LABELS[parsed.category],
        fileName: parsed.fileName,
        id: fileId,
        lines: parsedLines,
        rawContent,
        service: parsed.service,
        serviceLabel: SERVICE_LABELS[parsed.service],
        sizeBytes: stat.size,
        stats,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch (readErr) {
      logger.app.error(`Error al leer contenido de log: ${fileId}`, readErr);
    }
  }

  return results;
}

export async function getRawLogFile(fileId: string): Promise<{ content: string; fileName: string } | null> {
  const parsed = parseFileId(fileId);
  if (!parsed) return null;

  const baseDir = getLogsBaseDir(parsed.service);
  const filePath = path.join(baseDir, parsed.category, parsed.fileName);
  const resolvedPath = path.resolve(filePath);
  const expectedDir = path.resolve(baseDir, parsed.category);

  if (!resolvedPath.startsWith(expectedDir) || !fs.existsSync(resolvedPath)) {
    return null;
  }

  const content = await fs.promises.readFile(resolvedPath, 'utf8');
  const safeName = `${parsed.service}_${parsed.category}_${parsed.fileName}`;
  return { content, fileName: safeName };
}
