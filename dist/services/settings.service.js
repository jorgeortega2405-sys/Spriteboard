/**
 * Servicio de Configuración de Usuario, Preferencias y Auditoría
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { logger } from './logger.service.js';
import { validateEmail, validateUsername } from '../utils/validators.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_DIR = path.join(__dirname, '../../public/uploads/avatars');
import { isValidLanguageCode, detectLanguageFromHeader, } from '../utils/languages.js';
import { sanitizeAvatar } from './image-sanitizer.service.js';
import { generateSixDigitCode, saveEmailChangeCode, verifyEmailChangeCode, isEmailChangeAuthorized, consumeEmailChangeAuthorization, } from './verification.service.js';
import { sendEmailChangeCodeEmail } from './mail.service.js';
const DEFAULT_PREFERENCES = {
    theme: 'system',
    language: 'en-US',
    open_links_new_tab: true,
    telemetry: false,
    reduce_motion: false,
    high_contrast: false,
    extended_alerts: false,
};
/**
 * Registra una acción en la tabla de auditoría
 */
export async function logUserAudit(userId, action, oldValue, newValue, ipAddress, userAgent) {
    try {
        await pool.query('INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)', [userId, action, oldValue, newValue, ipAddress || null, userAgent ? userAgent.substring(0, 255) : null]);
        logger.security.info('Auditoría de usuario registrada', { userId, action, oldValue, newValue });
    }
    catch (error) {
        logger.db.error('Error al insertar registro de auditoría de usuario', error);
    }
}
/**
 * Obtiene las preferencias del usuario o crea las predeterminadas si no existen
 */
export async function getUserPreferences(userId, acceptLanguageHeader) {
    const [rows] = await pool.query('SELECT user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts FROM user_preferences WHERE user_id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
        const defaultLang = detectLanguageFromHeader(acceptLanguageHeader);
        await pool.query(`INSERT INTO user_preferences (user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`, [
            userId,
            DEFAULT_PREFERENCES.theme,
            defaultLang,
            DEFAULT_PREFERENCES.open_links_new_tab ? 1 : 0,
            DEFAULT_PREFERENCES.telemetry ? 1 : 0,
            DEFAULT_PREFERENCES.reduce_motion ? 1 : 0,
            DEFAULT_PREFERENCES.high_contrast ? 1 : 0,
            DEFAULT_PREFERENCES.extended_alerts ? 1 : 0,
        ]);
        return { ...DEFAULT_PREFERENCES, language: defaultLang };
    }
    const r = rows[0];
    return {
        theme: r.theme || DEFAULT_PREFERENCES.theme,
        language: r.language || DEFAULT_PREFERENCES.language,
        open_links_new_tab: Boolean(r.open_links_new_tab),
        telemetry: Boolean(r.telemetry),
        reduce_motion: Boolean(r.reduce_motion),
        high_contrast: Boolean(r.high_contrast),
        extended_alerts: Boolean(r.extended_alerts),
    };
}
/**
 * Actualiza una o más preferencias del usuario
 */
export async function updateUserPreferences(userId, updates) {
    const current = await getUserPreferences(userId);
    const next = {
        theme: updates.theme !== undefined ? String(updates.theme).toLowerCase() : current.theme,
        language: updates.language !== undefined ? String(updates.language).trim() : current.language,
        open_links_new_tab: updates.open_links_new_tab !== undefined ? Boolean(updates.open_links_new_tab) : current.open_links_new_tab,
        telemetry: updates.telemetry !== undefined ? Boolean(updates.telemetry) : current.telemetry,
        reduce_motion: updates.reduce_motion !== undefined ? Boolean(updates.reduce_motion) : current.reduce_motion,
        high_contrast: updates.high_contrast !== undefined ? Boolean(updates.high_contrast) : current.high_contrast,
        extended_alerts: updates.extended_alerts !== undefined ? Boolean(updates.extended_alerts) : current.extended_alerts,
    };
    const validThemes = ['system', 'light', 'dark'];
    if (!validThemes.includes(next.theme))
        next.theme = 'system';
    if (!isValidLanguageCode(next.language)) {
        next.language = current.language || 'en-US';
    }
    await pool.query(`INSERT INTO user_preferences (user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       theme = VALUES(theme),
       language = VALUES(language),
       open_links_new_tab = VALUES(open_links_new_tab),
       telemetry = VALUES(telemetry),
       reduce_motion = VALUES(reduce_motion),
       high_contrast = VALUES(high_contrast),
       extended_alerts = VALUES(extended_alerts)`, [
        userId,
        next.theme,
        next.language,
        next.open_links_new_tab ? 1 : 0,
        next.telemetry ? 1 : 0,
        next.reduce_motion ? 1 : 0,
        next.high_contrast ? 1 : 0,
        next.extended_alerts ? 1 : 0,
    ]);
    return next;
}
async function safeUnlink(filePath) {
    try {
        await fs.promises.unlink(filePath);
    }
    catch {
        // Ignorar si ya no existe
    }
}
/**
 * Actualiza el avatar personalizado del usuario
 */
export async function updateAvatar(userId, file, ip, ua) {
    if (!file) {
        return { success: false, error: 'No se ha subido ningún archivo.' };
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
        if (file.path) {
            await safeUnlink(file.path);
        }
        return { success: false, error: 'La imagen no debe superar los 2 MB.' };
    }
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
        if (file.path) {
            await safeUnlink(file.path);
        }
        return { success: false, error: 'Formato de imagen no compatible. Usa PNG, JPG o WEBP.' };
    }
    let imageBuffer = null;
    if (file.buffer) {
        imageBuffer = file.buffer;
    }
    else if (file.path) {
        try {
            imageBuffer = await fs.promises.readFile(file.path);
            await safeUnlink(file.path);
        }
        catch (err) {
            logger.app.error('Error al leer archivo temporal de avatar', err);
        }
    }
    if (!imageBuffer) {
        return { success: false, error: 'No se pudo leer el contenido de la imagen.' };
    }
    // Sanitizar, reconstruir y purgar metadatos de la imagen
    let sanitized;
    try {
        sanitized = await sanitizeAvatar(imageBuffer);
    }
    catch (err) {
        logger.security.warn('Rechazo o fallo de sanitización de avatar', {
            userId,
            error: err?.message,
        });
        return {
            success: false,
            error: err?.message || 'La imagen no pudo ser procesada o tiene un formato no válido.',
        };
    }
    const [rows] = await pool.query('SELECT id, avatar_url FROM users WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
        return { success: false, error: 'Usuario no encontrado.' };
    }
    const oldAvatarUrl = rows[0].avatar_url;
    if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
        const oldFileName = path.basename(oldAvatarUrl);
        const oldFilePath = path.join(AVATARS_DIR, oldFileName);
        await safeUnlink(oldFilePath);
    }
    const newFileName = `avatar_${userId}_${Date.now()}.${sanitized.extension}`;
    const targetPath = path.join(AVATARS_DIR, newFileName);
    try {
        await fs.promises.mkdir(AVATARS_DIR, { recursive: true });
        await fs.promises.writeFile(targetPath, sanitized.buffer);
    }
    catch (err) {
        logger.app.error('Error al persistir el avatar sanitizado en disco', err);
        return { success: false, error: 'Error al guardar la imagen en el servidor.' };
    }
    const newAvatarUrl = `/uploads/avatars/${newFileName}`;
    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [newAvatarUrl, userId]);
    await logUserAudit(userId, 'update_avatar', oldAvatarUrl, newAvatarUrl, ip, ua);
    return { success: true, avatar_url: newAvatarUrl };
}
/**
 * Elimina el avatar personalizado y restablece al valor por defecto (NULL)
 */
export async function deleteAvatar(userId, ip, ua) {
    const [rows] = await pool.query('SELECT id, username, avatar_url FROM users WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
        return { success: false, avatar_url: null, error: 'Usuario no encontrado.' };
    }
    const oldAvatarUrl = rows[0].avatar_url;
    if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
        const oldFileName = path.basename(oldAvatarUrl);
        const oldFilePath = path.join(AVATARS_DIR, oldFileName);
        await safeUnlink(oldFilePath);
    }
    await pool.query('UPDATE users SET avatar_url = NULL WHERE id = ?', [userId]);
    await logUserAudit(userId, 'delete_avatar', oldAvatarUrl, null, ip, ua);
    return { success: true, avatar_url: null };
}
/**
 * Actualiza el nombre de usuario
 */
export async function updateUsername(userId, newUsername, ip, ua) {
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
        return { success: false, error: validation.error, status: 400 };
    }
    const cleanUsername = newUsername.trim();
    const [currentUserRows] = await pool.query('SELECT id, username FROM users WHERE id = ? LIMIT 1', [userId]);
    if (currentUserRows.length === 0) {
        return { success: false, error: 'Usuario no encontrado.', status: 404 };
    }
    const oldUsername = currentUserRows[0].username;
    if (oldUsername.toLowerCase() === cleanUsername.toLowerCase()) {
        return { success: true, username: oldUsername };
    }
    const [existingRows] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1', [cleanUsername, userId]);
    if (existingRows.length > 0) {
        return { success: false, error: 'El nombre de usuario ya está en uso.', status: 409 };
    }
    await pool.query('UPDATE users SET username = ? WHERE id = ?', [cleanUsername, userId]);
    await logUserAudit(userId, 'update_username', oldUsername, cleanUsername, ip, ua);
    return { success: true, username: cleanUsername };
}
/**
 * Solicita un código de verificación para cambio de correo electrónico y lo envía por email
 */
export async function requestEmailChangeCode(userId, ip, ua) {
    // Comprobar si ya cuenta con autorización activa en la ventana de 5 minutos
    const alreadyAuthorized = await isEmailChangeAuthorized(userId);
    if (alreadyAuthorized) {
        logger.security.info('Usuario ya autorizado para cambio de correo dentro de la ventana de 5 minutos', { userId });
        return { success: true, alreadyAuthorized: true };
    }
    const [userRows] = await pool.query('SELECT id, username, email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (userRows.length === 0) {
        return { success: false, error: 'Usuario no encontrado.', status: 404 };
    }
    const user = userRows[0];
    if (!user.email) {
        return { success: false, error: 'La cuenta no tiene un correo electrónico registrado.', status: 400 };
    }
    const code = generateSixDigitCode();
    await saveEmailChangeCode(userId, user.email, code, 300); // 5 minutos
    try {
        await sendEmailChangeCodeEmail(user.email, user.username, code, 5);
        logger.security.info('Código de cambio de correo enviado al usuario', { userId, email: user.email });
    }
    catch (error) {
        logger.app.error('Error al enviar correo con código de cambio de email', error);
        return { success: false, error: 'No se pudo enviar el correo de verificación. Intenta más tarde.', status: 500 };
    }
    return { success: true, alreadyAuthorized: false };
}
/**
 * Valida el código de verificación para cambio de correo y activa la ventana de 5 minutos
 */
export async function verifyEmailChange(userId, code) {
    if (!code || typeof code !== 'string' || !code.trim()) {
        return { success: false, error: 'El código de verificación es obligatorio.', status: 400 };
    }
    const result = await verifyEmailChangeCode(userId, code.trim());
    if (!result.success || !result.token) {
        return { success: false, error: result.error || 'Código incorrecto o expirado.', status: 400 };
    }
    return { success: true, token: result.token };
}
/**
 * Actualiza el correo electrónico exigiendo autorización previa activa de 5 minutos
 */
export async function updateEmail(userId, newEmail, ip, ua) {
    const authValidation = await consumeEmailChangeAuthorization(userId);
    if (!authValidation.valid) {
        return {
            success: false,
            error: authValidation.error || 'La autorización de 5 minutos para cambiar de correo ha expirado.',
            status: 403,
        };
    }
    const validation = validateEmail(newEmail);
    if (!validation.valid) {
        return { success: false, error: validation.error, status: 400 };
    }
    const cleanEmail = newEmail.toLowerCase().trim();
    const [currentUserRows] = await pool.query('SELECT id, email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (currentUserRows.length === 0) {
        return { success: false, error: 'Usuario no encontrado.', status: 404 };
    }
    const oldEmail = currentUserRows[0].email;
    if (oldEmail.toLowerCase() === cleanEmail) {
        return { success: true, email: oldEmail };
    }
    const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [cleanEmail, userId]);
    if (existingRows.length > 0) {
        return { success: false, error: 'El correo electrónico ya está registrado.', status: 409 };
    }
    await pool.query('UPDATE users SET email = ? WHERE id = ?', [cleanEmail, userId]);
    await logUserAudit(userId, 'update_email', oldEmail, cleanEmail, ip, ua);
    return { success: true, email: cleanEmail };
}
