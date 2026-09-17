import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { getAllRoles } from '../services/role.service.js';
import { applyUserSanction, deleteUserAvatarByAdmin, getUserDetails, getUserManagementData, listUsers, revokeUserAllSessionsByAdmin, revokeUserSanction, updateUserAccount, updateUserAvatarByAdmin, updateUserEmailByAdmin, updateUserPreferencesByAdmin, updateUserRoles, updateUserUsernameByAdmin } from '../services/user.service.js';

export async function handleGetUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const two_factor = typeof req.query.two_factor === 'string' ? req.query.two_factor : undefined;

    const result = await listUsers({ limit, page, role, search, two_factor });
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.app.error('Error al listar usuarios en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleGetUserById(req: Request, res: Response): Promise<void> {
  try {
    const userIdentifier = req.params.id;
    if (!userIdentifier || !String(userIdentifier).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    const { sanctions, user } = await getUserDetails(userIdentifier);
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.', ok: false });
      return;
    }

    const sanitizedUser = {
      avatar_url: user.avatar_url || null,
      created_at: user.created_at || null,
      email: user.email,
      google_id: user.google_id || null,
      id: user.id,
      last_login_at: user.last_login_at || null,
      last_login_city: user.last_login_city || null,
      last_login_country: user.last_login_country || null,
      last_login_ip: user.last_login_ip || null,
      last_login_isp: user.last_login_isp || null,
      role: user.role,
      roles: user.roles || [user.role || 'USER'],
      subscription_tier: user.subscription_tier || 'free',
      two_factor_enabled: Boolean(user.two_factor_enabled),
      username: user.username,
      uuid: user.uuid || null,
    };

    res.json({ ok: true, sanctions, user: sanitizedUser });
  } catch (error) {
    logger.app.error('Error al obtener detalle de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleUpdateUserRoles(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { roles } = req.body;

    if (!userId || !String(userId).trim() || !Array.isArray(roles) || roles.length === 0) {
      res.status(400).json({ error: 'Parámetros no válidos. Debes especificar al menos un rol.', ok: false });
      return;
    }

    const result = await updateUserRoles(userId, roles, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al actualizar roles.', ok: false });
      return;
    }

    res.json({ message: 'Roles actualizados exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al actualizar roles de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleUpdateUserAccount(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { email, subscription_tier, username } = req.body;

    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    const result = await updateUserAccount(userId, { email, subscription_tier, username }, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al actualizar cuenta.', ok: false });
      return;
    }

    res.json({ message: 'Cuenta actualizada exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al actualizar cuenta de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleApplyUserSanction(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { durationDays, reason, type } = req.body;

    if (!userId || !String(userId).trim() || !type || !reason || !['ban', 'suspension', 'warning'].includes(type)) {
      res.status(400).json({ error: 'Datos de sanción incompletos o no válidos.', ok: false });
      return;
    }

    const result = await applyUserSanction(
      userId,
      {
        durationDays: durationDays ? Number(durationDays) : undefined,
        reason: String(reason).trim(),
        type,
      },
      adminUser.id
    );

    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al aplicar sanción.', ok: false });
      return;
    }

    res.json({ message: 'Sanción aplicada exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al aplicar sanción a usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleGetUserSanctions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.id;
    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    const { sanctions, user } = await getUserDetails(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.', ok: false });
      return;
    }

    const sanitizedUser = {
      avatar_url: user.avatar_url || null,
      created_at: user.created_at || null,
      email: user.email,
      google_id: user.google_id || null,
      id: user.id,
      role: user.role,
      roles: user.roles || [user.role || 'USER'],
      subscription_tier: user.subscription_tier || 'free',
      username: user.username,
      uuid: user.uuid || null,
    };

    res.json({ ok: true, sanctions, user: sanitizedUser });
  } catch (error) {
    logger.app.error('Error al obtener sanciones de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleRevokeUserSanction(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const sanctionId = Number(req.params.sanctionId);
    if (!sanctionId || isNaN(sanctionId)) {
      res.status(400).json({ error: 'ID de sanción no válido.', ok: false });
      return;
    }

    const result = await revokeUserSanction(sanctionId, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al revocar sanción.', ok: false });
      return;
    }

    res.json({ message: 'Sanción revocada exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al revocar sanción en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleGetAllRoles(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await getAllRoles();
    res.json({ ok: true, roles });
  } catch (error) {
    logger.app.error('Error al obtener lista de roles en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleGetUserManagementData(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.id;
    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    const { activeSessionsCount, preferences, user } = await getUserManagementData(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.', ok: false });
      return;
    }

    const sanitizedUser = {
      avatar_url: user.avatar_url || null,
      created_at: user.created_at || null,
      email: user.email,
      google_id: user.google_id || null,
      id: user.id,
      last_login_at: user.last_login_at || null,
      last_login_city: user.last_login_city || null,
      last_login_country: user.last_login_country || null,
      last_login_ip: user.last_login_ip || null,
      last_login_isp: user.last_login_isp || null,
      role: user.role,
      roles: user.roles || [user.role || 'USER'],
      subscription_tier: user.subscription_tier || 'free',
      two_factor_enabled: Boolean(user.two_factor_enabled),
      username: user.username,
      uuid: user.uuid || null,
    };

    res.json({ activeSessionsCount, ok: true, preferences, user: sanitizedUser });
  } catch (error) {
    logger.app.error('Error al obtener datos de gestión de usuario en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminUpdateUserUsername(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { username } = req.body;

    if (!userId || !String(userId).trim() || !username) {
      res.status(400).json({ error: 'Parámetros no válidos.', ok: false });
      return;
    }

    const result = await updateUserUsernameByAdmin(userId, username, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al actualizar nombre de usuario.', ok: false });
      return;
    }

    res.json({ message: 'Nombre de usuario actualizado con éxito.', ok: true, username: username.trim() });
  } catch (error) {
    logger.app.error('Error al actualizar nombre de usuario por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminUpdateUserEmail(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { email } = req.body;

    if (!userId || !String(userId).trim() || !email) {
      res.status(400).json({ error: 'Parámetros no válidos.', ok: false });
      return;
    }

    const result = await updateUserEmailByAdmin(userId, email, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al actualizar correo electrónico.', ok: false });
      return;
    }

    res.json({ email: email.trim().toLowerCase(), message: 'Correo electrónico actualizado con éxito.', ok: true });
  } catch (error) {
    logger.app.error('Error al actualizar correo electrónico por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminUpdateUserAvatar(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    const { avatarBase64 } = req.body;

    if (!userId || !String(userId).trim() || !avatarBase64 || typeof avatarBase64 !== 'string') {
      res.status(400).json({ error: 'Formato de imagen no válido.', ok: false });
      return;
    }

    const matches = avatarBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Formato de imagen base64 no válido.', ok: false });
      return;
    }

    const rawMime = matches[1].toLowerCase();
    const allowedMimes = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
    if (!allowedMimes.includes(rawMime)) {
      res.status(400).json({ error: 'Formato de imagen no compatible. Usa JPG, PNG o WEBP.', ok: false });
      return;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'La imagen supera el límite permitido de 2 MB.', ok: false });
      return;
    }

    const result = await updateUserAvatarByAdmin(userId, buffer, adminUser.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Error al guardar avatar.', ok: false });
      return;
    }

    res.json({ avatar_url: result.avatar_url, message: 'Avatar actualizado con éxito.', ok: true });
  } catch (error) {
    logger.app.error('Error al actualizar avatar de usuario por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminDeleteUserAvatar(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    await deleteUserAvatarByAdmin(userId, adminUser.id);
    res.json({ avatar_url: null, message: 'Avatar restablecido correctamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al eliminar avatar de usuario por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminUpdateUserPreferences(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    const updates = req.body || {};
    const result = await updateUserPreferencesByAdmin(userId, updates, adminUser.id);
    res.json({ message: 'Preferencias actualizadas con éxito.', ok: true, preferences: result.preferences });
  } catch (error) {
    logger.app.error('Error al actualizar preferencias de usuario por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

export async function handleAdminRevokeUserSessions(req: Request, res: Response): Promise<void> {
  try {
    const adminUser = getCurrentUser(req);
    if (!adminUser) {
      res.status(401).json({ error: 'No autorizado.', ok: false });
      return;
    }

    const userId = req.params.id;
    if (!userId || !String(userId).trim()) {
      res.status(400).json({ error: 'Identificador de usuario no válido.', ok: false });
      return;
    }

    await revokeUserAllSessionsByAdmin(userId, adminUser.id);
    res.json({ message: 'Todas las sesiones del usuario han sido revocadas exitosamente.', ok: true });
  } catch (error) {
    logger.app.error('Error al revocar sesiones de usuario por admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}

