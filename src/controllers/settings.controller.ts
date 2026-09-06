/**
 * Controlador de Ajustes, Perfil, Preferencias y Auditoría
 */

import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import {
  updateActiveAccountInSession,
  removeAccountFromSession,
  addAccountToSession,
} from '../services/auth.service.js';
import {
  updateAvatar,
  deleteAvatar,
  updateUsername,
  requestEmailChangeCode,
  verifyEmailChange,
  updateEmail,
  getUserPreferences,
  updateUserPreferences,
  getPasswordStatus,
  verifyCurrentPassword,
  updateUserPasswordFromSettings,
  logUserAudit,
} from '../services/settings.service.js';
import {
  findUserById,
  enableUser2FA,
  disableUser2FA,
  deleteUserPermanently,
} from '../services/user.service.js';
import {
  generateTotpSecret,
  generateBackupCodes,
  getOtpAuthUrl,
  verifyTotpCode,
  savePending2FASetup,
  getPending2FASetup,
  clearPending2FASetup,
} from '../services/two-factor.service.js';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendConflict,
  sendInternalError,
  sanitizeUser,
} from '../utils/http.util.js';
import { logger } from '../services/logger.service.js';

/**
 * Actualizar avatar del usuario
 */
export async function handleUpdateAvatar(req: Request, res: Response): Promise<void> {
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

    const result = await updateAvatar(
      currentUser.id,
      req.file,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success || !result.avatar_url) {
      sendBadRequest(res, result.error || 'No se pudo actualizar la foto de perfil.');
      return;
    }

    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    sendSuccess(res, {
      message: 'Foto de perfil actualizada exitosamente.',
      avatar_url: result.avatar_url,
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar foto de perfil', error, 'Error al subir la imagen. Inténtalo de nuevo.');
  }
}

/**
 * Eliminar avatar del usuario (restablecer a default)
 */
export async function handleDeleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const result = await deleteAvatar(
      currentUser.id,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      sendBadRequest(res, result.error || 'No se pudo eliminar la foto de perfil.');
      return;
    }

    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    sendSuccess(res, {
      message: 'Foto de perfil eliminada. Se ha restaurado la foto predeterminada.',
      avatar_url: null,
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (error) {
    sendInternalError(res, 'Error al eliminar foto de perfil', error, 'Error al eliminar la imagen.');
  }
}

/**
 * Actualizar nombre de usuario
 */
export async function handleUpdateUsername(req: Request, res: Response): Promise<void> {
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

    const result = await updateUsername(
      currentUser.id,
      username,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      if (result.status === 409) {
        sendConflict(res, result.error || 'El nombre de usuario ya está en uso.');
      } else {
        sendBadRequest(res, result.error || 'Nombre de usuario inválido.');
      }
      return;
    }

    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    sendSuccess(res, {
      message: 'Nombre de usuario actualizado exitosamente.',
      username: result.username,
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar nombre de usuario', error, 'Error al actualizar el nombre de usuario.');
  }
}

/**
 * Solicitar código de verificación para cambio de correo
 */
export async function handleRequestEmailChangeCode(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const result = await requestEmailChangeCode(
      currentUser.id,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      sendBadRequest(res, result.error || 'No se pudo enviar el código de verificación.');
      return;
    }

    sendSuccess(res, {
      message: result.alreadyAuthorized
        ? 'Ya cuentas con autorización activa para cambiar tu correo.'
        : 'Código de verificación enviado exitosamente a tu correo actual.',
      alreadyAuthorized: Boolean(result.alreadyAuthorized),
    });
  } catch (error) {
    sendInternalError(res, 'Error al solicitar código de cambio de correo', error, 'Error al solicitar el código de verificación.');
  }
}

/**
 * Verificar código de cambio de correo y emitir token temporal
 */
export async function handleVerifyEmailChangeCode(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      sendBadRequest(res, 'El código de verificación es obligatorio.');
      return;
    }

    const result = await verifyEmailChange(currentUser.id, code);

    if (!result.success || !result.token) {
      sendBadRequest(res, result.error || 'Código de verificación inválido o expirado.');
      return;
    }

    sendSuccess(res, {
      message: 'Código verificado con éxito.',
      token: result.token,
    });
  } catch (error) {
    sendInternalError(res, 'Error al verificar código de cambio de correo', error, 'Error al verificar el código de verificación.');
  }
}

/**
 * Actualizar correo electrónico utilizando el token de autorización
 */
export async function handleUpdateEmail(req: Request, res: Response): Promise<void> {
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

    const result = await updateEmail(
      currentUser.id,
      email,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      if (result.status === 409) {
        sendConflict(res, result.error || 'El correo electrónico ya está registrado.');
      } else if (result.status === 403) {
        sendUnauthorized(res, result.error || 'La autorización de 5 minutos para cambiar de correo ha expirado.');
      } else {
        sendBadRequest(res, result.error || 'Correo electrónico inválido.');
      }
      return;
    }

    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    sendSuccess(res, {
      message: 'Correo electrónico actualizado exitosamente.',
      email: result.email,
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar correo electrónico', error, 'Error al actualizar el correo electrónico.');
  }
}

/**
 * Obtener preferencias del usuario
 */
export async function handleGetPreferences(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const preferences = await getUserPreferences(currentUser.id);
    sendSuccess(res, { preferences });
  } catch (error) {
    sendInternalError(res, 'Error al obtener preferencias de usuario', error, 'Error al cargar preferencias.');
  }
}

/**
 * Actualizar preferencias del usuario
 */
export async function handleUpdatePreferences(req: Request, res: Response): Promise<void> {
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
  } catch (error) {
    sendInternalError(res, 'Error al actualizar preferencias de usuario', error, 'Error al guardar preferencias.');
  }
}

/**
 * Consultar estado de acceso y credenciales (si tiene Google y/o contraseña)
 */
export async function handleGetPasswordStatus(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const status = await getPasswordStatus(currentUser.id);
    sendSuccess(res, status);
  } catch (error) {
    sendInternalError(res, 'Error al consultar estado de contraseña', error, 'Error al consultar estado de la cuenta.');
  }
}

/**
 * Verificar contraseña actual del usuario
 */
export async function handleVerifyCurrentPassword(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const { currentPassword } = req.body || {};
    const result = await verifyCurrentPassword(currentUser.id, currentPassword);

    if (!result.success) {
      sendBadRequest(res, result.error || 'La contraseña actual es incorrecta.');
      return;
    }

    sendSuccess(res, { message: 'Contraseña actual verificada correctamente.' });
  } catch (error) {
    sendInternalError(res, 'Error al verificar contraseña actual', error, 'Error al verificar contraseña.');
  }
}

/**
 * Actualizar contraseña del usuario
 */
export async function handleUpdatePassword(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const { newPassword } = req.body || {};
    const result = await updateUserPasswordFromSettings(
      currentUser.id,
      newPassword,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      if (result.status === 403) {
        res.status(403).json({ error: result.error || 'Autorización expirada.' });
        return;
      }
      sendBadRequest(res, result.error || 'No se pudo actualizar la contraseña.');
      return;
    }

    // Re-emitir sesión activa válida para este dispositivo manteniendo las cuentas vinculadas
    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      await addAccountToSession(res, req, sanitizeUser(updatedUser));
    }

    sendSuccess(res, { message: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar contraseña', error, 'Error al guardar la nueva contraseña.');
  }
}

/**
 * Generar nuevo secreto y códigos de respaldo para configurar 2FA
 */
export async function handleGenerate2FA(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    // Reutilizar configuración pendiente existente si aún no ha expirado y no se solicita regenerar
    const forceNew = req.query.force === 'true';
    let pending = forceNew ? null : await getPending2FASetup(currentUser.id);

    if (!pending) {
      const secret = generateTotpSecret(20);
      const backupCodes = generateBackupCodes(10);
      pending = { secret, backupCodes };
      await savePending2FASetup(currentUser.id, pending, 900);
    }

    const qrUri = getOtpAuthUrl(pending.secret, currentUser.username);

    logger.security.info('Configuración de 2FA iniciada', { userId: currentUser.id });

    sendSuccess(res, {
      secret: pending.secret,
      qrUri,
      backupCodes: pending.backupCodes,
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al generar configuración de 2FA',
      error,
      'Error al iniciar la configuración de dos pasos.'
    );
  }
}

/**
 * Confirmar código de la app y activar 2FA
 */
export async function handleEnable2FA(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      sendBadRequest(res, 'Ingresa el código de 6 dígitos de tu aplicación.');
      return;
    }

    const pending = await getPending2FASetup(currentUser.id);
    if (!pending) {
      sendBadRequest(res, 'La sesión de configuración de 2FA ha expirado. Genera un nuevo código QR.');
      return;
    }

    // Usar ventana de tolerancia de ±120s (4 pasos) durante la configuración inicial para absorber desincronizaciones de reloj
    const isValid = verifyTotpCode(code.trim(), pending.secret, 4);
    if (!isValid) {
      logger.security.warn('Código TOTP incorrecto al intentar activar 2FA', { userId: currentUser.id });
      sendBadRequest(res, 'El código ingresado es incorrecto o ha expirado.');
      return;
    }

    // Activar en base de datos
    await enableUser2FA(currentUser.id, pending.secret, pending.backupCodes);

    // Limpiar configuración pendiente en Redis
    await clearPending2FASetup(currentUser.id);

    // Registrar en auditoría
    await logUserAudit(
      currentUser.id,
      '2fa_enabled',
      'disabled',
      'enabled',
      req.ip,
      req.headers['user-agent']
    );

    // Actualizar cuenta activa en sesión
    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    logger.security.info('2FA activado exitosamente', { userId: currentUser.id });

    sendSuccess(res, {
      message: 'Autenticación en dos pasos activada exitosamente.',
      backupCodes: pending.backupCodes,
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al activar autenticación en dos pasos',
      error,
      'Error al activar la protección de dos pasos.'
    );
  }
}

/**
 * Desactivar 2FA
 */
export async function handleDisable2FA(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    await disableUser2FA(currentUser.id);

    // Registrar en auditoría
    await logUserAudit(
      currentUser.id,
      '2fa_disabled',
      'enabled',
      'disabled',
      req.ip,
      req.headers['user-agent']
    );

    const updatedUser = await findUserById(currentUser.id);
    if (updatedUser) {
      updateActiveAccountInSession(res, req, sanitizeUser(updatedUser));
    }

    logger.security.info('2FA desactivado exitosamente', { userId: currentUser.id });

    sendSuccess(res, {
      message: 'Autenticación en dos pasos desactivada exitosamente.',
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al desactivar autenticación en dos pasos',
      error,
      'Error al desactivar la protección de dos pasos.'
    );
  }
}

/**
 * Consultar estado de 2FA
 */
export async function handleGet2FAStatus(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const user = await findUserById(currentUser.id);
    sendSuccess(res, {
      enabled: Boolean(user?.two_factor_enabled),
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al consultar estado de 2FA',
      error,
      'Error al consultar el estado de seguridad.'
    );
  }
}

/**
 * Eliminar la cuenta del usuario activo y purgar todos sus datos permanentemente
 */
export async function handleDeleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión no válida o expirada.');
      return;
    }

    const userId = currentUser.id;
    const deleted = await deleteUserPermanently(userId);
    if (!deleted) {
      sendBadRequest(res, 'No se pudo encontrar o eliminar la cuenta.');
      return;
    }

    // Remover cuenta de la sesión multicuentas (conmuta a la siguiente o limpia cookies)
    const sessionResult = await removeAccountFromSession(res, req, userId);

    logger.security.info('Cuenta eliminada permanentemente por el usuario', {
      userId,
      remainingAccounts: sessionResult.remainingCount,
    });

    sendSuccess(res, {
      message: 'Tu cuenta y todos sus datos han sido eliminados permanentemente.',
      remainingAccounts: sessionResult.remainingCount,
      switched: sessionResult.remainingCount > 0,
      activeUser: sessionResult.activeUser ? sanitizeUser(sessionResult.activeUser) : null,
      accounts: sessionResult.accounts.map(sanitizeUser),
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al eliminar cuenta',
      error,
      'No se pudo eliminar tu cuenta. Por favor intenta más tarde.'
    );
  }
}


