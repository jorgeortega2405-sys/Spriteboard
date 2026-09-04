/**
 * Servicio Genérico de Sanitización, Reconstrucción y Seguridad de Imágenes
 *
 * Elimina metadatos EXIF, IPTC, XMP, comentarios ocultos, scripts políglotas,
 * previene ataques de denegación de servicio por bombas de descompresión de píxeles
 * y reconstruye la matriz de píxeles en un búfer limpio antes de persistirlo.
 */
import sharp from 'sharp';
import { logger } from './logger.service.js';
const MIME_MAP = {
    jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
    png: { mimeType: 'image/png', extension: 'png' },
    webp: { mimeType: 'image/webp', extension: 'webp' },
    gif: { mimeType: 'image/gif', extension: 'gif' },
    avif: { mimeType: 'image/avif', extension: 'avif' },
};
/**
 * Inspecciona los primeros bytes del búfer para verificar su firma real (Magic Bytes).
 * Previene ataques donde se camuflan scripts o archivos maliciosos cambiando la extensión o MIME.
 */
export function detectMagicBytes(buffer) {
    if (!buffer || buffer.length < 12) {
        return null;
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { format: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' };
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a) {
        return { format: 'png', mimeType: 'image/png', extension: 'png' };
    }
    // GIF: GIF87a (47 49 46 38 37 61) o GIF89a (47 49 46 38 39 61)
    if (buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61) {
        return { format: 'gif', mimeType: 'image/gif', extension: 'gif' };
    }
    // WebP: RIFF [4 bytes tamaño] WEBP
    if (buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50) {
        return { format: 'webp', mimeType: 'image/webp', extension: 'webp' };
    }
    // AVIF: ftypavif en bytes 4-11
    if (buffer.length >= 12 &&
        buffer[4] === 0x66 &&
        buffer[5] === 0x74 &&
        buffer[6] === 0x79 &&
        buffer[7] === 0x70 &&
        buffer[8] === 0x61 &&
        buffer[9] === 0x76 &&
        buffer[10] === 0x69 &&
        buffer[11] === 0x66) {
        return { format: 'avif', mimeType: 'image/avif', extension: 'avif' };
    }
    return null;
}
/**
 * Sanitiza, valida y reconstruye completamente una imagen a partir de su búfer binario.
 *
 * - Valida firmas de cabecera (Magic Bytes).
 * - Protege contra bombas de descompresión de píxeles (Pixel Flood / Decompression Bombs).
 * - Aplica rotación automática basada en orientación EXIF antes de purgar los metadatos.
 * - Reconstruye la imagen en memoria, purgando EXIF, IPTC, XMP, perfiles incrustados y scripts.
 * - Redimensiona de forma segura si se especifican límites.
 */
export async function sanitizeImage(inputBuffer, options = {}) {
    if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
        throw new Error('El archivo de imagen está vacío o no es un búfer válido.');
    }
    // 1. Verificación de Magic Bytes
    const magic = detectMagicBytes(inputBuffer);
    if (!magic) {
        logger.security.warn('Rechazo de imagen: Firma de Magic Bytes desconocida o no autorizada.');
        throw new Error('El archivo no contiene una firma de imagen válida o compatible.');
    }
    // 2. Configurar límites de seguridad contra bombas de descompresión
    const maxPixels = options.maxPixels || 16 * 1024 * 1024; // 16 Megapíxeles por defecto
    let pipeline;
    try {
        pipeline = sharp(inputBuffer, {
            failOn: 'error',
            limitInputPixels: maxPixels,
            animated: magic.format === 'gif',
        });
    }
    catch (err) {
        logger.security.error('Error al inicializar decodificador de imagen con Sharp', err);
        throw new Error('No se pudo procesar la imagen proporcionada.');
    }
    // 3. Inspeccionar metadatos originales decodificados de forma segura
    let metadata;
    try {
        metadata = await pipeline.metadata();
    }
    catch (err) {
        logger.security.warn('Error al decodificar estructura interna de la imagen', err);
        throw new Error('La imagen está dañada o contiene una estructura interna no válida.');
    }
    if (!metadata.width || !metadata.height) {
        throw new Error('No se pudieron determinar las dimensiones de la imagen.');
    }
    // 4. Determinar formato de salida
    let targetFormat;
    if (options.format && options.format !== 'original') {
        targetFormat = options.format;
    }
    else {
        targetFormat = magic.format;
    }
    // 5. Aplicar auto-rotación por orientación EXIF (antes de eliminar metadatos)
    pipeline = pipeline.rotate();
    // 6. Redimensionar si se solicitaron límites
    if (options.maxWidth || options.maxHeight) {
        pipeline = pipeline.resize({
            width: options.maxWidth,
            height: options.maxHeight,
            fit: options.fit || 'inside',
            withoutEnlargement: true,
        });
    }
    // 7. Re-codificar en el formato objetivo sin incluir metadatos EXIF / perfiles no estándar
    const quality = options.quality && options.quality >= 1 && options.quality <= 100 ? options.quality : 85;
    switch (targetFormat) {
        case 'webp':
            pipeline = pipeline.webp({ quality, effort: 4 });
            break;
        case 'jpeg':
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
            break;
        case 'png':
            pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
            break;
        case 'avif':
            pipeline = pipeline.avif({ quality, effort: 4 });
            break;
        case 'gif':
            pipeline = pipeline.gif();
            break;
        default:
            pipeline = pipeline.webp({ quality });
            targetFormat = 'webp';
            break;
    }
    // 8. Reconstrucción completa del búfer de salida purgado
    let outputBuffer;
    let outputInfo;
    try {
        const res = await pipeline.toBuffer({ resolveWithObject: true });
        outputBuffer = res.data;
        outputInfo = res.info;
    }
    catch (err) {
        logger.app.error('Error durante la reconstrucción del búfer de imagen', err);
        throw new Error('Ocurrió un error al procesar y reconstruir la imagen.');
    }
    const { mimeType, extension } = MIME_MAP[targetFormat] || MIME_MAP.webp;
    return {
        buffer: outputBuffer,
        format: targetFormat,
        mimeType,
        extension,
        width: outputInfo.width,
        height: outputInfo.height,
        size: outputBuffer.length,
    };
}
/**
 * Preset especializado para sanitización y optimización de fotos de perfil (Avatares).
 * Normaliza las imágenes a 512x512 px máx., formato WebP limpio y ligero.
 */
export async function sanitizeAvatar(inputBuffer) {
    return sanitizeImage(inputBuffer, {
        maxWidth: 512,
        maxHeight: 512,
        fit: 'cover',
        format: 'webp',
        quality: 85,
        maxPixels: 8 * 1024 * 1024, // 8 Megapíxeles máx de entrada
    });
}
