import { verifySessionToken, getMultiAccountSession, clearSessionCookie, isSessionRevoked, COOKIE_NAME, } from '../services/auth.service.js';
export function getCurrentUser(req) {
    // Caché a nivel de request para evitar re-análisis HMAC y de JSON en múltiples llamadas
    if (req.user) {
        return req.user;
    }
    const token = req.cookies?.[COOKIE_NAME];
    if (!token)
        return null;
    const user = verifySessionToken(token);
    if (user) {
        req.user = user;
    }
    return user;
}
export function getLinkedAccounts(req) {
    const session = getMultiAccountSession(req);
    return session ? session.accounts : [];
}
export async function requireAuth(req, res, next) {
    const user = getCurrentUser(req);
    if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
        return;
    }
    // Comprobar si la sesión fue revocada en el servidor (ej. logout-all o cambio de contraseña)
    const session = getMultiAccountSession(req);
    if (session && session.iat) {
        const revoked = await isSessionRevoked(user.id, session.iat);
        if (revoked) {
            clearSessionCookie(res);
            res.status(401).json({ error: 'Sesión expirada o revocada. Inicia sesión de nuevo.' });
            return;
        }
    }
    req.user = user;
    res.locals.user = user;
    next();
}
