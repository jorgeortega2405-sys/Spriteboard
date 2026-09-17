import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getMultiAccountSession, updateActiveAccountInSession } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { checkCurrentPassword, deleteAvatar, disable2FA, enable2FA, generate2FASecret, get2FAStatus, getUserActiveSessions, getUserPreferences, revokeUserSessionById, unlinkGoogleAccount, updateAvatarFile, updateEmail, updatePassword, updateUserPreferences, updateUsername } from '../services/settings.service.js';

export async function handleGetPreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const preferences = await getUserPreferences(user.id);
    res.json({ preferences });
  } catch (error) {
    logger.app.error('Error al obtener preferencias en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUpdatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const updates = req.body || {};
    const preferences = await updateUserPreferences(user.id, updates);
    res.json({ message: 'Preferencias actualizadas con éxito.', preferences });
  } catch (error) {
    logger.app.error('Error al actualizar preferencias en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUpdateUsername(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { username } = req.body;
    const result = await updateUsername(user.id, username);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    updateActiveAccountInSession(res, req, { username: username.trim() });
    res.json({ message: 'Nombre de usuario actualizado con éxito.', username: username.trim() });
  } catch (error) {
    logger.app.error('Error al actualizar nombre de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUpdateEmail(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { email } = req.body;
    const result = await updateEmail(user.id, email);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    updateActiveAccountInSession(res, req, { email: email.trim().toLowerCase() });
    res.json({ email: email.trim().toLowerCase(), message: 'Correo electrónico actualizado con éxito.' });
  } catch (error) {
    logger.app.error('Error al actualizar correo electrónico en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUnlinkGoogle(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const result = await unlinkGoogleAccount(user.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    updateActiveAccountInSession(res, req, { google_id: null });
    res.json({ message: 'Cuenta de Google desvinculada exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al desvincular Google en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleVerifyCurrentPassword(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { password } = req.body;
    const isValid = await checkCurrentPassword(user.id, password);
    if (!isValid) {
      res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
      return;
    }
    res.json({ message: 'Contraseña verificada correctamente.', valid: true });
  } catch (error) {
    logger.app.error('Error al verificar contraseña actual en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUpdatePassword(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { currentPassword, newPassword } = req.body;
    const isCurrentValid = await checkCurrentPassword(user.id, currentPassword);
    if (!isCurrentValid) {
      res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      return;
    }
    const result = await updatePassword(user.id, newPassword);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Contraseña modificada correctamente.' });
  } catch (error) {
    logger.app.error('Error al cambiar contraseña en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleGet2FAStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const status = await get2FAStatus(user.id);
    res.json(status);
  } catch (error) {
    logger.app.error('Error al obtener estado 2FA en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleGenerate2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const data = await generate2FASecret(user.id, user.username);
    res.json(data);
  } catch (error) {
    logger.app.error('Error al generar secreto 2FA en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleEnable2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { code, secret } = req.body;
    const result = await enable2FA(user.id, code, secret);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      message: 'Autenticación en dos pasos activada exitosamente.',
      recoveryCodes: result.recoveryCodes,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al activar 2FA en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleDisable2FA(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { password } = req.body;
    const result = await disable2FA(user.id, password);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Autenticación en dos pasos desactivada correctamente.', success: true });
  } catch (error) {
    logger.app.error('Error al desactivar 2FA en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleDeleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    await deleteAvatar(user.id);
    updateActiveAccountInSession(res, req, { avatar_url: null });
    res.json({ avatar_url: null, message: 'Avatar restablecido correctamente.' });
  } catch (error) {
    logger.app.error('Error al eliminar avatar en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleUpdateAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { avatarBase64 } = req.body;
    if (!avatarBase64 || typeof avatarBase64 !== 'string') {
      res.status(400).json({ error: 'No se recibió ninguna imagen válida.' });
      return;
    }

    const matches = avatarBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Formato de imagen base64 no válido.' });
      return;
    }

    const rawMime = matches[1].toLowerCase();
    const allowedMimes = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
    if (!allowedMimes.includes(rawMime)) {
      res.status(400).json({ error: 'Formato de imagen no compatible. Usa JPG, PNG o WEBP.' });
      return;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'La imagen supera el límite permitido de 2 MB.' });
      return;
    }

    const result = await updateAvatarFile(user.id, buffer);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'No se pudo guardar la imagen de perfil.' });
      return;
    }

    updateActiveAccountInSession(res, req, { avatar_url: result.avatar_url });
    res.json({ avatar_url: result.avatar_url, message: 'Avatar actualizado con éxito.' });
  } catch (error) {
    logger.app.error('Error al actualizar avatar en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleGetActiveSessions(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const session = getMultiAccountSession(req);
    const activeAccount = session?.accounts.find((a) => a.id === user.id);
    const currentSessionId = activeAccount?.sessionId || session?.sessionId;

    const sessions = await getUserActiveSessions(user.id, currentSessionId);
    res.json({ sessions });
  } catch (error) {
    logger.app.error('Error al obtener sesiones activas en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function handleRevokeSession(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'ID de sesión no proporcionado.' });
      return;
    }
    await revokeUserSessionById(user.id, sessionId);
    res.json({ message: 'Sesión revocada exitosamente.' });
  } catch (error) {
    logger.app.error('Error al revocar sesión en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
