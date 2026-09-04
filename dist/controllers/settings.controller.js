/**
 * Controlador de Ajustes, Perfil, Preferencias y Auditoría
 */
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { setSessionCookie } from '../services/auth.service.js';
import { updateAvatar, deleteAvatar, updateUsername, updateEmail, getUserPreferences, updateUserPreferences, } from '../services/settings.service.js';
import { findUserById } from '../services/user.service.js';
import { sendSuccess, sendBadRequest, sendUnauthorized, sendConflict, sendInternalError, sanitizeUser, } from '../utils/http.js';
/**
 * Actualizar avatar del usuario
 */
export async function handleUpdateAvatar(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        if (!req.file) {
            sendBadRequest(res, 'Debes seleccionar un archivo de imagen válido.');
            return;
        }
        const result = await updateAvatar(currentUser.id, req.file, req.ip, req.headers['user-agent']);
        if (!result.success || !result.avatar_url) {
            sendBadRequest(res, result.error || 'No se pudo actualizar la foto de perfil.');
            return;
        }
        const updatedUser = await findUserById(currentUser.id);
        if (updatedUser) {
            setSessionCookie(res, sanitizeUser(updatedUser));
        }
        sendSuccess(res, {
            message: 'Foto de perfil actualizada exitosamente.',
            avatar_url: result.avatar_url,
            user: updatedUser ? sanitizeUser(updatedUser) : null,
        });
    }
    catch (error) {
        sendInternalError(res, 'Error al actualizar foto de perfil', error, 'Error al subir la imagen. Inténtalo de nuevo.');
    }
}
/**
 * Eliminar avatar del usuario (restablecer a default)
 */
export async function handleDeleteAvatar(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        const result = await deleteAvatar(currentUser.id, req.ip, req.headers['user-agent']);
        if (!result.success) {
            sendBadRequest(res, result.error || 'No se pudo eliminar la foto de perfil.');
            return;
        }
        const updatedUser = await findUserById(currentUser.id);
        if (updatedUser) {
            setSessionCookie(res, sanitizeUser(updatedUser));
        }
        sendSuccess(res, {
            message: 'Foto de perfil eliminada. Se ha restaurado la foto predeterminada.',
            avatar_url: null,
            user: updatedUser ? sanitizeUser(updatedUser) : null,
        });
    }
    catch (error) {
        sendInternalError(res, 'Error al eliminar foto de perfil', error, 'Error al eliminar la imagen.');
    }
}
/**
 * Actualizar nombre de usuario
 */
export async function handleUpdateUsername(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        const { username } = req.body;
        if (!username || typeof username !== 'string') {
            sendBadRequest(res, 'El nombre de usuario es obligatorio.');
            return;
        }
        const result = await updateUsername(currentUser.id, username, req.ip, req.headers['user-agent']);
        if (!result.success) {
            if (result.status === 409) {
                sendConflict(res, result.error || 'El nombre de usuario ya está en uso.');
            }
            else {
                sendBadRequest(res, result.error || 'Nombre de usuario inválido.');
            }
            return;
        }
        const updatedUser = await findUserById(currentUser.id);
        if (updatedUser) {
            setSessionCookie(res, sanitizeUser(updatedUser));
        }
        sendSuccess(res, {
            message: 'Nombre de usuario actualizado exitosamente.',
            username: result.username,
            user: updatedUser ? sanitizeUser(updatedUser) : null,
        });
    }
    catch (error) {
        sendInternalError(res, 'Error al actualizar nombre de usuario', error, 'Error al actualizar el nombre de usuario.');
    }
}
/**
 * Actualizar correo electrónico
 */
export async function handleUpdateEmail(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            sendBadRequest(res, 'El correo electrónico es obligatorio.');
            return;
        }
        const result = await updateEmail(currentUser.id, email, req.ip, req.headers['user-agent']);
        if (!result.success) {
            if (result.status === 409) {
                sendConflict(res, result.error || 'El correo electrónico ya está registrado.');
            }
            else {
                sendBadRequest(res, result.error || 'Correo electrónico inválido.');
            }
            return;
        }
        const updatedUser = await findUserById(currentUser.id);
        if (updatedUser) {
            setSessionCookie(res, sanitizeUser(updatedUser));
        }
        sendSuccess(res, {
            message: 'Correo electrónico actualizado exitosamente.',
            email: result.email,
            user: updatedUser ? sanitizeUser(updatedUser) : null,
        });
    }
    catch (error) {
        sendInternalError(res, 'Error al actualizar correo electrónico', error, 'Error al actualizar el correo electrónico.');
    }
}
/**
 * Obtener preferencias del usuario
 */
export async function handleGetPreferences(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        const preferences = await getUserPreferences(currentUser.id);
        sendSuccess(res, { preferences });
    }
    catch (error) {
        sendInternalError(res, 'Error al obtener preferencias de usuario', error, 'Error al cargar preferencias.');
    }
}
/**
 * Actualizar preferencias del usuario
 */
export async function handleUpdatePreferences(req, res) {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            sendUnauthorized(res, 'Sesión no válida o expirada.');
            return;
        }
        const preferences = await updateUserPreferences(currentUser.id, req.body || {});
        sendSuccess(res, {
            message: 'Preferencias actualizadas exitosamente.',
            preferences,
        });
    }
    catch (error) {
        sendInternalError(res, 'Error al actualizar preferencias de usuario', error, 'Error al guardar preferencias.');
    }
}
