import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_ROOT_DIR = path.resolve(__dirname, '../../logs');
const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'csrf',
    'csrftoken',
    'secret',
    'cookie',
    'session',
    'authorization',
    'creditcard',
    'smtp_pass',
]);
/**
 * Sanitiza recursivamente objetos y metadatos para ocultar credenciales y tokens
 */
function sanitize(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === 'string') {
        return obj;
    }
    if (obj instanceof Error) {
        return {
            name: obj.name,
            message: obj.message,
            stack: obj.stack,
        };
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.has(lowerKey)) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitize(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    return obj;
}
class CategoryLogger {
    category;
    categoryDir;
    constructor(category) {
        this.category = category;
        this.categoryDir = path.join(LOGS_ROOT_DIR, category);
    }
    ensureDirectory() {
        try {
            if (!fs.existsSync(this.categoryDir)) {
                fs.mkdirSync(this.categoryDir, { recursive: true });
            }
        }
        catch {
            // Ignorar errores al crear directorios si ya existen concurrentemente
        }
    }
    getLogFilePath() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.categoryDir, `${today}.log`);
    }
    async writeLog(level, message, meta, errorObj) {
        try {
            this.ensureDirectory();
            const timestamp = new Date().toISOString();
            let logLine = `[${timestamp}] [${level}] [${this.category.toUpperCase()}] ${message}`;
            if (errorObj) {
                const sanitizedErr = sanitize(errorObj);
                if (sanitizedErr instanceof Error || (typeof sanitizedErr === 'object' && sanitizedErr !== null && 'message' in sanitizedErr)) {
                    const errObj = sanitizedErr;
                    logLine += ` | Error: ${errObj.message || ''}`;
                    if (errObj.stack) {
                        logLine += `\nStack: ${errObj.stack}`;
                    }
                }
                else {
                    logLine += ` | Error: ${JSON.stringify(sanitizedErr)}`;
                }
            }
            if (meta !== undefined) {
                const sanitizedMeta = sanitize(meta);
                logLine += ` | Meta: ${JSON.stringify(sanitizedMeta)}`;
            }
            logLine += '\n';
            const filePath = this.getLogFilePath();
            await fs.promises.appendFile(filePath, logLine, 'utf8');
        }
        catch {
            // Operación silenciosa y resiliente: no crashea la aplicación
        }
    }
    info(message, meta) {
        void this.writeLog('INFO', message, meta);
    }
    warn(message, meta) {
        void this.writeLog('WARN', message, meta);
    }
    error(message, error, meta) {
        void this.writeLog('ERROR', message, meta, error);
    }
    debug(message, meta) {
        void this.writeLog('DEBUG', message, meta);
    }
}
/**
 * Instancia centralizada del sistema de logs con 3 categorías
 */
export const logger = {
    app: new CategoryLogger('app'),
    db: new CategoryLogger('database'),
    security: new CategoryLogger('security'),
};
export default logger;
